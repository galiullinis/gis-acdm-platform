import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("GisDAOVoting", () => {
    let owner: SignerWithAddress
    let account1: SignerWithAddress
    let account2: SignerWithAddress
    let account3: SignerWithAddress
    let chairman: SignerWithAddress
    let gisDaoVoting: Contract
    let erc20Token: Contract
    let stakingContract: Contract;

    const stakingTokenName = "UNISWAPToken"
    const stakingTokenSymbol = "UNI-V2"
    let stakingToken: Contract

    const rewardTokenName = "GisToken"
    const rewardTokenSymbol = "GIS"
    let rewardToken: Contract

    const debatingPeriodDuration = 60 * 60 * 24 * 36
    const minimumQuorumPercent = 50
    const erc20MintAmount = 10000

    async function addProposal(recipient = erc20Token.address, description = "some info") {
        const calldata = getCalldata()
        await gisDaoVoting.connect(chairman).addProposal(calldata, recipient, description)
    }

    function getCalldata(){
        const iface = new ethers.utils.Interface([
            "function transfer(address account, uint256 amount)"
        ])

        const calldata = iface.encodeFunctionData("transfer", [account3.address, 2000])
        return calldata
    }

    beforeEach(async () => {
        [owner, account1, account2, account3, chairman] = await ethers.getSigners()
        
        const GisERC20Token = await ethers.getContractFactory("GisToken", owner)
        erc20Token = await GisERC20Token.deploy("TokenName", "TokenSymbol", 18)
        await erc20Token.deployed()

        const GisDAOVoting = await ethers.getContractFactory("GisDAOVoting", owner)
        gisDaoVoting = await GisDAOVoting.deploy(chairman.address, erc20Token.address, minimumQuorumPercent, debatingPeriodDuration)
        await gisDaoVoting.deployed()

        const StakingToken = await ethers.getContractFactory("GisToken", owner)
        const RewardToken = await ethers.getContractFactory("GisToken", owner)
        const StakingContract = await ethers.getContractFactory("GisStaking", owner)

        stakingToken = await StakingToken.deploy(stakingTokenName, stakingTokenSymbol, 18)
        await stakingToken.deployed()

        rewardToken = await RewardToken.deploy(rewardTokenName, rewardTokenSymbol, 18)
        await rewardToken.deployed()

        stakingContract = await StakingContract.deploy(stakingToken.address, rewardToken.address)
        await stakingContract.deployed()


        await erc20Token.connect(account1).approve(gisDaoVoting.address, 10000000)
        await erc20Token.connect(account2).approve(gisDaoVoting.address, 10000000)
        await erc20Token.connect(account3).approve(gisDaoVoting.address, 10000000)
        await erc20Token.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), owner.address)
        await erc20Token.mint(account1.address, erc20MintAmount)
        await erc20Token.mint(account2.address, erc20MintAmount)
        await erc20Token.mint(account3.address, erc20MintAmount)
        await erc20Token.mint(gisDaoVoting.address, erc20MintAmount)

        await stakingToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), owner.address)
        await rewardToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), owner.address)
        await rewardToken.mint(stakingContract.address, erc20MintAmount)
        await stakingToken.mint(account1.address, erc20MintAmount)
        await stakingToken.mint(account2.address, erc20MintAmount)
        await stakingToken.mint(account3.address, erc20MintAmount)
        await stakingToken.connect(account1).approve(stakingContract.address, erc20MintAmount)
        await stakingToken.connect(account2).approve(stakingContract.address, erc20MintAmount)
        await stakingToken.connect(account3).approve(stakingContract.address, erc20MintAmount)
        await gisDaoVoting.setStakingContract(stakingContract.address)
        await stakingContract.setDaoContract(gisDaoVoting.address)
    })

    it("add proposal reverts", async () => {
        const calldata = getCalldata()
        await expect(gisDaoVoting.addProposal(calldata, erc20Token.address, "Mint tokens to account3")).to.be.revertedWith("you are not the chairman")
        await expect(gisDaoVoting.connect(chairman).addProposal(calldata, ethers.constants.AddressZero, "some info")).to.be.revertedWith("incorrect params")
    })

    it("add proposal to dao", async () => {
        await addProposal()
        const [startAt, stopAt, posQuorum, negQuorum, callData, description, recipient, isFinished] = await gisDaoVoting.getProposalById(1)

        expect(recipient).to.eq(erc20Token.address)
    })

    it("vote for proposal reverts", async () => {
        await addProposal()
        const stakeAmount = 1000
        
        await expect(gisDaoVoting.connect(account1).vote(1, true)).to.be.revertedWith("you don't have deposit for vote")
        await expect(gisDaoVoting.connect(account1).vote(2, true)).to.be.revertedWith("proposal is not active")

        await stakingContract.connect(account1).stake(stakeAmount)
        await gisDaoVoting.connect(account1).vote(1, true)
        await expect(gisDaoVoting.connect(account1).vote(1, true)).to.be.revertedWith("you already had voted")
    })

    it("vote for proposal", async () => {
        await addProposal()
        await stakingContract.connect(account1).stake(5000)
        await stakingContract.connect(account2).stake(2500)

        await gisDaoVoting.connect(account1).vote(1, true)
        await gisDaoVoting.connect(account2).vote(1, false)
        const [startAt, stopAt, posQuorum, negQuorum, callData, description, recipient, isFinished] = await gisDaoVoting.getProposalById(1)
        expect(posQuorum).to.eq(5000)
        expect(negQuorum).to.eq(2500)
    })

    it("finish reverts", async () => {
        await addProposal()
        await stakingContract.connect(account1).stake(5000)
        await stakingContract.connect(account2).stake(2500)

        await gisDaoVoting.connect(account1).vote(1, true)
        await gisDaoVoting.connect(account2).vote(1, false)

        await expect(gisDaoVoting.finish(1)).to.be.revertedWith("proposal is in progress")

        await addProposal()

        await ethers.provider.send(
                "evm_increaseTime",
                [debatingPeriodDuration + 1000]
            );

        await expect(gisDaoVoting.finish(2)).to.be.revertedWith("minimal quorum not reached")
        
        const iface = new ethers.utils.Interface([
            "function mint(address account, uint256 amount)"
        ])

        const calldata = iface.encodeFunctionData("mint", [account3.address, 2000])
        await gisDaoVoting.connect(chairman).addProposal(calldata, erc20Token.address, "some info")

        await gisDaoVoting.connect(account1).vote(3, true)
        await gisDaoVoting.connect(account2).vote(3, false)

        await ethers.provider.send(
            "evm_increaseTime",
            [debatingPeriodDuration + 1000]
        );

        await expect(gisDaoVoting.finish(3)).to.be.reverted

        await addProposal()

        await gisDaoVoting.connect(account1).vote(4, false)
        await gisDaoVoting.connect(account2).vote(4, true)

        await ethers.provider.send(
            "evm_increaseTime",
            [debatingPeriodDuration + 1000]
        );

        await expect(gisDaoVoting.finish(4)).to.be.revertedWith("not enough positive votes")
    })

    it("finish proposal", async () => {
        await addProposal()
        await stakingContract.connect(account1).stake(5000)
        await stakingContract.connect(account2).stake(2500)

        await gisDaoVoting.connect(account1).vote(1, true)
        await gisDaoVoting.connect(account2).vote(1, false)

        await ethers.provider.send(
            "evm_increaseTime",
            [debatingPeriodDuration + 1000]
        );

        await gisDaoVoting.finish(1)
        expect(await erc20Token.balanceOf(account3.address)).to.eq(erc20MintAmount + 2000)

        await expect(gisDaoVoting.finish(1)).to.be.revertedWith("proposal is finished")
    })

    it("staking unstake reverts", async () => {
        await addProposal()
        await stakingContract.setRewardFrequency(60 * 60 * 24 * 3)
        await stakingContract.setRewardPercent(1, 0)
        const stakeTime = 60 * 60 * 24 * 33
        const tx = await stakingContract.connect(account1).stake(5000)
        await tx.wait()
        await ethers.provider.send(
            "evm_increaseTime",
            [stakeTime]
        );

        await gisDaoVoting.connect(account1).vote(1, true)
        await expect(stakingContract.connect(account1).unstake()).to.be.revertedWith("you have an active proposal in the dao")
    })

    it("set chairman", async () => {
        await expect(gisDaoVoting.setChairman(ethers.constants.AddressZero)).to.be.revertedWith("incorrect address")
        await gisDaoVoting.setChairman(account2.address)
        expect(await gisDaoVoting.chairman()).to.eq(account2.address)
    })

    it("set minimum quorum percent", async () => {
        await expect(gisDaoVoting.setMinimumQuorum(0)).to.be.revertedWith("incorrect value")
        await gisDaoVoting.setMinimumQuorum(70)
        expect(await gisDaoVoting.minimumQuorumPercent()).to.eq(70)
    })

    it("set debating period duration", async () => {
        await expect(gisDaoVoting.setDebatingPeriodDuration(0)).to.be.revertedWith("incorrect value")
        await gisDaoVoting.setDebatingPeriodDuration(3600)
        expect(await gisDaoVoting.debatingPeriodDuration()).to.eq(3600)
    })

    it("revert request to zero address balance from staking",async () => {
        await expect(gisDaoVoting.getAddressBalanceFromStaking(ethers.constants.AddressZero)).to.be.revertedWith("zero address")
    })

    it("revert setting zero address for staking contract",async () => {
        await expect(gisDaoVoting.setStakingContract(ethers.constants.AddressZero)).to.be.revertedWith("zero address")
    })
})