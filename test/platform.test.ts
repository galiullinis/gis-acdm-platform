import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { time } from "console";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("ACDMPlatform", () => {
    const ROUND_TIME = 20
    let owner: SignerWithAddress
    let account1: SignerWithAddress
    let account2: SignerWithAddress
    let account3: SignerWithAddress
    let account4: SignerWithAddress
    let account5: SignerWithAddress
    let account6: SignerWithAddress
    let chairman: SignerWithAddress
    let acdmPlatform: Contract
    let acdmPlatform2: Contract
    let erc20Token: Contract
    let gisDaoVoting: Contract

    const stakingTokenName = "UNISWAPToken"
    const stakingTokenSymbol = "UNI-V2"
    let stakingToken: Contract

    const rewardTokenName = "GisToken"
    const rewardTokenSymbol = "GIS"
    let rewardToken: Contract

    let stakingContract: Contract;
    

    beforeEach(async () => {
        [owner, account1, account2, account3, account4, account5, account6, chairman] = await ethers.getSigners()
        
        const GisERC20Token = await ethers.getContractFactory("GisToken", owner)
        erc20Token = await GisERC20Token.deploy("TokenName", "TokenSymbol", 18)
        await erc20Token.deployed()

        const ACDMPlatform = await ethers.getContractFactory("ACDMPlatform", owner)
        await expect(ACDMPlatform.deploy(ethers.constants.AddressZero, 0)).to.be.revertedWith("incorrect params")
        acdmPlatform = await ACDMPlatform.deploy(erc20Token.address, ROUND_TIME)
        acdmPlatform2 = await ACDMPlatform.deploy(erc20Token.address, ROUND_TIME)
        await acdmPlatform.deployed()
        await acdmPlatform2.deployed()

        await erc20Token.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), acdmPlatform.address)
        await erc20Token.connect(account1).approve(acdmPlatform.address, 100000000000000)
        await erc20Token.connect(account4).approve(acdmPlatform.address, 100000000000000)
        await erc20Token.connect(account3).approve(acdmPlatform.address, 100000000000000)
    })

    it("register user",async () => {
        await acdmPlatform.connect(account1)["register()"]()
        const [isRegistered, refferer] = await acdmPlatform.getUserByAddress(account1.address)
        expect(isRegistered).to.eq(true)
        expect(refferer).to.eq(ethers.constants.AddressZero)
    })

    it("should be reverted double register",async () => {
        await acdmPlatform.connect(account1)["register()"]()
        await expect(acdmPlatform.connect(account1)["register()"]()).to.be.revertedWith("user had already registered")
    })

    it("should be reverted unregistered refferer",async () => {
        await expect(acdmPlatform.connect(account2)["register(address)"](account1.address)).to.be.revertedWith("referrer not registered")
    })

    it("register user with refferer",async () => {
        await acdmPlatform.connect(account1)["register()"]()
        await acdmPlatform.connect(account2)["register(address)"](account1.address)
        const [isRegistered, refferer] = await acdmPlatform.getUserByAddress(account2.address)
        expect(isRegistered).to.eq(true)
        expect(refferer).to.eq(account1.address)
    })

    describe("SALE", () => {
        beforeEach(async () => {
            await acdmPlatform.connect(account1)["register()"]()
        })

        it("should be reverted unregistered calls",async () => {
            await expect(acdmPlatform.connect(account2).startSaleRound()).to.be.revertedWith("not registered")
        })

        it("should revert to buy tokens without starting the round",async () => {
            await expect(acdmPlatform.connect(account1).buyACDM()).to.be.revertedWith("sale is not active")
        })

        it("should revert to buy tokens after round time is up",async () => {
            await acdmPlatform.connect(account1).startSaleRound()
            await ethers.provider.send(
                "evm_increaseTime",
                [ROUND_TIME + 10]
            )
            await expect(acdmPlatform.connect(account1).buyACDM()).to.be.revertedWith("round expired")
        })

        it("should revert if insufficient funds",async () => {
            await acdmPlatform.connect(account1).startSaleRound()
            await expect(acdmPlatform.connect(account1).buyACDM({value: 10})).to.be.revertedWith("not enough ethers sent")
        })

        it("start first sale round",async () => {
            const tx = await acdmPlatform.connect(account1).startSaleRound()
            const Sale = await acdmPlatform.getSaleByRoundId(1)
            const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp
            expect(Sale.isActive).to.eq(true)
            expect(Sale.tokenAmount).to.eq(100000 * 10 ** 6)
            expect(Sale.tokenPrice).to.eq(ethers.utils.parseEther("0.00001"))
            expect(Sale.startedAt).to.eq(blockTimestamp)
            expect(Sale.stoppedAt).to.eq(blockTimestamp + ROUND_TIME)
        })
    
        it("should be reverted double round start",async () => {
            await acdmPlatform.connect(account1).startSaleRound()
            await expect(acdmPlatform.connect(account1).startSaleRound()).to.be.revertedWith("sale round is active")
        })
    
        it("buy ACDM on Sale",async () => {
            await acdmPlatform.connect(account1).startSaleRound()
            await acdmPlatform.connect(account1).buyACDM({value: ethers.utils.parseEther("0.5")})
            const boughtCount = (ethers.utils.parseEther("0.5").div(ethers.utils.parseEther("0.00001"))).mul(BigInt(10 ** 6))
            expect(await erc20Token.balanceOf(account1.address)).to.eq(boughtCount)
            const Sale = await acdmPlatform.getSaleByRoundId(1)
            expect(Sale.tokenAmount).to.eq(100000 * 10 ** 6 - boughtCount.toNumber())
        })

        it("buy ACDM tokens with excess",async () => {
            await acdmPlatform.connect(account1).startSaleRound()
            const tx = await acdmPlatform.connect(account1).buyACDM({value: ethers.utils.parseEther("3")})
            const boughtCount = (ethers.utils.parseEther("1").div(ethers.utils.parseEther("0.00001"))).mul(BigInt(10 ** 6))
            expect(await erc20Token.balanceOf(account1.address)).to.eq(boughtCount)
            const Sale = await acdmPlatform.getSaleByRoundId(1)
            expect(Sale.tokenAmount).to.eq(100000 * 10 ** 6 - boughtCount.toNumber())
            await expect(tx).to.changeEtherBalance(account1, -BigInt(1 * 10 ** 18))
        })

        it("should be reverted if platform hasn't minter role",async () => {
            await acdmPlatform2.connect(account1)["register()"]()
            await acdmPlatform2.connect(account1).startSaleRound()
            await expect(acdmPlatform2.connect(account1).buyACDM({ value: ethers.utils.parseEther("0.5") })).to.be.reverted

        })
    })

    it("revert zero round for trade",async () => {
        await acdmPlatform.connect(account1)["register()"]()
        await expect(acdmPlatform.connect(account1).startTradeRound()).to.be.revertedWith("zero round")
    })

    it("revert trade round start while sale round is active",async () => {
        await acdmPlatform.connect(account1)["register()"]()
        await acdmPlatform.connect(account1).startSaleRound()
        await expect(acdmPlatform.connect(account1).startTradeRound()).to.be.revertedWith("sale round is not finished")
    })

    describe("TRADE", () => {
        beforeEach(async () => {
            await acdmPlatform.connect(account1)["register()"]()
            await acdmPlatform.connect(account2)["register()"]()
            await acdmPlatform.connect(account5)["register()"]()
            await acdmPlatform.connect(account3)["register(address)"](account5.address)
            await acdmPlatform.connect(account4)["register(address)"](account3.address)
            await acdmPlatform.connect(account1).startSaleRound()
            await acdmPlatform.connect(account1).buyACDM({value: ethers.utils.parseEther("0.5")})
            await acdmPlatform.connect(account4).buyACDM({value: ethers.utils.parseEther("0.3")})
            await acdmPlatform.connect(account3).buyACDM({value: ethers.utils.parseEther("0.2")})
            await ethers.provider.send(
                "evm_increaseTime",
                [ROUND_TIME + 10]
            )
        })

        it("start trade round",async () => {
            const tx = await acdmPlatform.connect(account1).startTradeRound()
            const Trade = await acdmPlatform.getTradeByRoundId(1)
            const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp
            expect(Trade.isActive).to.eq(true)
            expect(Trade.turnover).to.eq(0)
            expect(Trade.startedAt).to.eq(blockTimestamp)
            expect(Trade.stoppedAt).to.eq(blockTimestamp + ROUND_TIME)
        })

        it("start trade round twice",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await expect(acdmPlatform.connect(account1).startTradeRound()).to.be.revertedWith("trade round is active")
        })

        it("should work 'tradable' modifier",async () => {
            await expect(acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.002"))).to.be.revertedWith("trade round is not active")
        })

        it("add order",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            const Order = await acdmPlatform.getOrderById(1)
            expect(Order.isActive).to.eq(true)
            expect(Order.seller).to.eq(account1.address)
            expect(Order.tokenAmount).to.eq(10000000000)
            expect(Order.tokenPrice).to.eq(ethers.utils.parseEther("0.002"))
            expect(await erc20Token.balanceOf(account1.address)).to.eq(40000000000)
            expect(await erc20Token.balanceOf(acdmPlatform.address)).to.eq(10000000000)
        })

        it("should be reverted adding order with incorrect params",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await expect(acdmPlatform.connect(account1).addOrder(0, ethers.utils.parseEther("0"))).to.be.revertedWith("incorrect params")
        })

        it("should be reverted adding order with amount of the tokens more than there is on balance",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await expect(acdmPlatform.connect(account1).addOrder(600000000000, ethers.utils.parseEther("0.002"))).to.be.revertedWith("insufficient tokens on balance")
        })

        it("remove order",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            await acdmPlatform.connect(account1).removeOrder(1)
            const Order = await acdmPlatform.getOrderById(1)
            expect(Order.isActive).to.eq(false)
            expect(await erc20Token.balanceOf(account1.address)).to.eq(50000000000)
            expect(await erc20Token.balanceOf(acdmPlatform.address)).to.eq(0)
        })

        it("should be reverted removing a foreign order",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            await expect(acdmPlatform.connect(account2).removeOrder(1)).to.be.revertedWith("you are not the seller")
        })

        it("should be reverted removing an inactive order",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            await expect(acdmPlatform.connect(account1).redeemOrder(1, {value: ethers.utils.parseEther("0.002").mul(10000)})).to.be.revertedWith("you are the seller")
            
            await acdmPlatform.connect(account2).redeemOrder(1, {value: ethers.utils.parseEther("0.002").mul(10000)})
            await expect(acdmPlatform.connect(account1).removeOrder(1)).to.be.revertedWith("order is not active")
        })

        it("redeem order",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            const tx = await acdmPlatform.connect(account2).redeemOrder(1, {value: ethers.utils.parseEther("0.002").mul(2000)})
            expect(await erc20Token.balanceOf(account2.address)).to.eq(2000000000)
            expect(await erc20Token.balanceOf(acdmPlatform.address)).to.eq(8000000000)
            await expect(tx).to.changeEtherBalance(account2, -BigInt(4 * 10 ** 18))
            await expect(tx).to.changeEtherBalance(account1, BigInt((4 * 10 ** 18) * 0.95))
            await expect(tx).to.changeEtherBalance(acdmPlatform, BigInt((4 * 10 ** 18) * 0.05))
        })

        it("redeem order with excess",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.00002"))
            const tx = await acdmPlatform.connect(account2).redeemOrder(1, {value: ethers.utils.parseEther("50")})
            expect(await erc20Token.balanceOf(account2.address)).to.eq(10000000000)
            await expect(tx).to.changeEtherBalance(account2, -BigInt(0.2 * 10 ** 18))
            await expect(tx).to.changeEtherBalance(account1, BigInt((0.2 * 10 ** 18) * 0.95))
            await expect(tx).to.changeEtherBalance(acdmPlatform, BigInt((0.2 * 10 ** 18) * 0.05))
        })

        it("redeem order with refferers",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account4).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            const tx = await acdmPlatform.connect(account2).redeemOrder(1, {value: ethers.utils.parseEther("0.002").mul(2000)})
            await expect(tx).to.changeEtherBalance(account2, -BigInt(4 * 10 ** 18))
            await expect(tx).to.changeEtherBalance(account4, BigInt((4 * 10 ** 18) * 0.95))
            await expect(tx).to.changeEtherBalance(account3, BigInt((4 * 10 ** 18) * 0.025))
            await expect(tx).to.changeEtherBalance(account5, BigInt((4 * 10 ** 18) * 0.025))
            await expect(tx).to.changeEtherBalance(acdmPlatform, 0)
        })

        it("redeem order with one refferer",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account3).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            const tx = await acdmPlatform.connect(account2).redeemOrder(1, {value: ethers.utils.parseEther("0.002").mul(2000)})
            await expect(tx).to.changeEtherBalance(account2, -BigInt(4 * 10 ** 18))
            await expect(tx).to.changeEtherBalance(account3, BigInt((4 * 10 ** 18) * 0.95))
            await expect(tx).to.changeEtherBalance(account5, BigInt((4 * 10 ** 18) * 0.025))
            await expect(tx).to.changeEtherBalance(acdmPlatform, BigInt((4 * 10 ** 18) * 0.025))
        })

        it("should be reverted redeeming an inactive order",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            await acdmPlatform.connect(account2).redeemOrder(1, {value: ethers.utils.parseEther("0.002").mul(10000)})
            await expect(acdmPlatform.connect(account3).redeemOrder(1, {value: ethers.utils.parseEther("0.002").mul(10000)})).to.be.revertedWith("order is not active")
        })

        it("should be reverted transaction with insufficient funds",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account1).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            await expect(acdmPlatform.connect(account2).redeemOrder(1, {value: 10})).to.be.revertedWith("not enough ethers sent")
        })

        it("start sale round after trade round",async () => {
            await acdmPlatform.connect(account1).startTradeRound()
            await acdmPlatform.connect(account4).addOrder(10000000000, ethers.utils.parseEther("0.002"))
            await acdmPlatform.connect(account2).redeemOrder(1, {value: ethers.utils.parseEther("0.002").mul(2000)})

            await expect(acdmPlatform.connect(account1).startSaleRound()).to.be.revertedWith("trade round is not finished")

            await ethers.provider.send(
                "evm_increaseTime",
                [ROUND_TIME + 10]
            )

            await acdmPlatform.connect(account1).startSaleRound()
            const Sale = await acdmPlatform.getSaleByRoundId(2)
            expect(Sale.isActive).to.eq(true)
            expect(Sale.tokenAmount).to.eq((4 / 0.00001 * 10 ** 6).toFixed())
            expect(Sale.tokenPrice).to.eq(ethers.utils.parseEther("0.0000143"))
        })
    })

    describe("DAO funcs", () => {
        beforeEach(async () => {
            const StakingToken = await ethers.getContractFactory("GisToken", owner)
            const RewardToken = await ethers.getContractFactory("GisToken", owner)
            const StakingContract = await ethers.getContractFactory("GisStaking", owner)
            
            stakingToken = await StakingToken.deploy(stakingTokenName, stakingTokenSymbol, 18)
            await stakingToken.deployed()

            rewardToken = await RewardToken.deploy(rewardTokenName, rewardTokenSymbol, 18)
            await rewardToken.deployed()

            stakingContract = await StakingContract.deploy(stakingToken.address, rewardToken.address)
            await stakingContract.deployed()

            const GisDAOVoting = await ethers.getContractFactory("GisDAOVoting", owner)
            gisDaoVoting = await GisDAOVoting.deploy(chairman.address, erc20Token.address, 30, 100)
            await gisDaoVoting.deployed()

            await stakingToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), owner.address)
            await rewardToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), owner.address)
            await acdmPlatform.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DAO_ROLE")), gisDaoVoting.address)
            await stakingToken.mint(account6.address, 10000)
            await stakingToken.mint(account5.address, 10000)
            await stakingToken.connect(account6).approve(stakingContract.address, 10000)
            await stakingToken.connect(account5).approve(stakingContract.address, 10000)
            await stakingContract.connect(account6).stake(2000)
            await stakingContract.connect(account5).stake(3000)
            await rewardToken.mint(stakingContract.address, 10000)

            await stakingContract.setDaoContract(gisDaoVoting.address)
            await gisDaoVoting.setStakingContract(stakingContract.address)

        })

        it("only dao revert",async () => {
            await expect(acdmPlatform.setTradeRewardSettings(4, 3, 0)).revertedWith("available only dao")
        })
    
        it("withdraw funds from platform",async () => {
            await acdmPlatform.connect(account1)["register()"]()
            await acdmPlatform.connect(account1).startSaleRound()
            await acdmPlatform.connect(account1).buyACDM({value: ethers.utils.parseEther("0.5")})
            
            const iface = new ethers.utils.Interface([
                "function withdraw(address _addr)"
            ])
    
            const calldata = iface.encodeFunctionData("withdraw", [chairman.address])
            await gisDaoVoting.connect(chairman).addProposal(calldata, acdmPlatform.address, "withdraw to chairman")

            await gisDaoVoting.connect(account6).vote(1, true)
            await gisDaoVoting.connect(account5).vote(1, true)

            await ethers.provider.send(
                "evm_increaseTime",
                [1000]
            );

            const tx = await gisDaoVoting.finish(1)

            await expect(tx).to.changeEtherBalance(chairman, ethers.utils.parseEther("0.5"))

        })

        it("set sale reward settings via dao",async () => {     
            const iface = new ethers.utils.Interface([
                "function setSaleRewardSettings(uint256 _firstRewardPercent, uint256 _secondRewardPercent, uint256 _percentPrecision)"
            ])
    
            const calldata = iface.encodeFunctionData("setSaleRewardSettings", [10, 8, 0])
            await gisDaoVoting.connect(chairman).addProposal(calldata, acdmPlatform.address, "set sale reward settings")

            await gisDaoVoting.connect(account6).vote(1, true)
            await gisDaoVoting.connect(account5).vote(1, true)

            await ethers.provider.send(
                "evm_increaseTime",
                [1000]
            );

            const tx = await gisDaoVoting.finish(1)
            const RewardSettings = await acdmPlatform.saleRewardSettings()
            expect(RewardSettings.firstRewardPercent).to.eq(10)
            expect(RewardSettings.secondRewardPercent).to.eq(8)
            expect(RewardSettings.rewardPercentPrecision).to.eq(0)

        })

        it("set trade reward settings via dao",async () => {
            const iface = new ethers.utils.Interface([
                "function setTradeRewardSettings(uint256 _firstRewardPercent, uint256 _secondRewardPercent, uint256 _percentPrecision)"
            ])
    
            const calldata = iface.encodeFunctionData("setTradeRewardSettings", [15, 5, 0])
            await gisDaoVoting.connect(chairman).addProposal(calldata, acdmPlatform.address, "set trade reward settings")

            await gisDaoVoting.connect(account6).vote(1, true)
            await gisDaoVoting.connect(account5).vote(1, true)

            await ethers.provider.send(
                "evm_increaseTime",
                [1000]
            );

            const tx = await gisDaoVoting.finish(1)

            const RewardSettings = await acdmPlatform.tradeRewardSettings()
            expect(RewardSettings.firstRewardPercent).to.eq(15)
            expect(RewardSettings.secondRewardPercent).to.eq(5)
            expect(RewardSettings.rewardPercentPrecision).to.eq(0)

        })
    })
})