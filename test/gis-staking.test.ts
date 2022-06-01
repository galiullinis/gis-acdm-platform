import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { doesNotMatch } from "assert";
import { AssertionError, expect } from "chai";
import { assert } from "console";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";

describe("GisStaking", () => {
    const stakingTokenName = "UNISWAPToken"
    const stakingTokenSymbol = "UNI-V2"
    let stakingToken: Contract

    const rewardTokenName = "GisToken"
    const rewardTokenSymbol = "GIS"
    let rewardToken: Contract
    let gisDaoVoting: Contract
    
    let owner: SignerWithAddress;
    let account2: SignerWithAddress;
    let account3: SignerWithAddress;
    let chairman: SignerWithAddress;
    let stakingContract: Contract;

    const stakingTokensMintAmount = 10000 
    const rewardTokensMintAmount = 10000

    const notAdminRevertedMessage = "you don't have admin role"

    beforeEach(async () => {
        [owner, account2, account3, chairman] = await ethers.getSigners()
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
        gisDaoVoting = await GisDAOVoting.deploy(chairman.address, stakingToken.address, 30, 100)
        await gisDaoVoting.deployed()

        await stakingToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), owner.address)
        await rewardToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), owner.address)
        await stakingToken.mint(account2.address, stakingTokensMintAmount)
        await stakingToken.connect(account2).approve(stakingContract.address, stakingTokensMintAmount)
        await stakingToken.mint(account3.address, stakingTokensMintAmount)
        await stakingToken.connect(account3).approve(stakingContract.address, stakingTokensMintAmount)
        
        await stakingContract.setDaoContract(gisDaoVoting.address)
        await gisDaoVoting.setStakingContract(stakingContract.address)

        await rewardToken.mint(stakingContract.address, rewardTokensMintAmount)
    })

    it("should stake correctly", async () => {
        const stakeAmount = 1000
        const tx = await stakingContract.connect(account2).stake(stakeAmount)
        await tx.wait()

        expect(await stakingToken.balanceOf(account2.address)).to.eq(stakingTokensMintAmount - stakeAmount)
        expect(await stakingToken.balanceOf(stakingContract.address)).to.eq(stakeAmount)
    })

    it("should stake correctly after stake", async () => {
        const stakeAmount = 1000
        const tx = await stakingContract.connect(account2).stake(stakeAmount)
        await tx.wait()
        const tx2 = await stakingContract.connect(account2).stake(stakeAmount)
        await tx2.wait()

        expect(await stakingToken.balanceOf(account2.address)).to.eq(stakingTokensMintAmount - 2 * stakeAmount)
        expect(await stakingToken.balanceOf(stakingContract.address)).to.eq(2 * stakeAmount)
    })

    it("should claim correctly", async () => {
        await stakingContract.setRewardFrequency(60 * 60 * 24 * 3)
        await stakingContract.setRewardPercent(1, 0)
        const stakeAmount = 100
        const stakeTime = 60 * 60 * 24 * 33
        const stakeFrequency = await stakingContract.rewardFrequency()
        const stakePercent = await stakingContract.rewardPercent()
        const stakePercentAccuracy = await stakingContract.rewardPercentAccuracy()
        let claimedValue = 0

        const tx = await stakingContract.connect(account2).stake(stakeAmount)
        await tx.wait()

        await ethers.provider.send(
            "evm_increaseTime",
            [stakeTime + 10]
        )

        const claimTx = await stakingContract.connect(account2).claim()
        await claimTx.wait()
        
        claimedValue = stakeAmount * stakePercent / 10 ** stakePercentAccuracy / 100 * stakeTime / stakeFrequency
        expect(await rewardToken.balanceOf(account2.address)).to.eq((claimedValue))
        expect(await rewardToken.balanceOf(stakingContract.address)).to.eq(rewardTokensMintAmount - claimedValue)
    })

    it("should revert claim if tokens freezed", async () => {
        const stakeAmount = 100

        const tx = await stakingContract.connect(account2).stake(stakeAmount)
        await expect(stakingContract.connect(account2).claim()).to.be.revertedWith("tokens freezed")
    })

    it("should unstake correctly", async () => {
        await stakingContract.setRewardFrequency(60 * 60 * 24 * 3)
        await stakingContract.setRewardPercent(1, 0)
        const stakeAmount = 100
        const stakeTime = 60 * 60 * 24 * 33
        const stakeFrequency = await stakingContract.rewardFrequency()
        const stakePercent = await stakingContract.rewardPercent()
        const stakePercentAccuracy = await stakingContract.rewardPercentAccuracy()
        let claimedValue = 0

        const tx = await stakingContract.connect(account2).stake(stakeAmount)
        await tx.wait()

        await ethers.provider.send(
            "evm_increaseTime",
            [stakeTime]
        )
        const unstakeTx = await stakingContract.connect(account2).unstake()
        await unstakeTx.wait()
        
        claimedValue = stakeAmount * stakePercent / 10 ** stakePercentAccuracy / 100 * stakeTime / stakeFrequency
        expect(await rewardToken.balanceOf(account2.address)).to.eq(claimedValue)
        expect(await rewardToken.balanceOf(stakingContract.address)).to.eq(rewardTokensMintAmount - claimedValue)

        expect(await stakingToken.balanceOf(account2.address)).to.eq(stakingTokensMintAmount)
        expect(await stakingToken.balanceOf(stakingContract.address)).to.eq(0)
    })

    it("claim after staking end", async () => {
        await stakingContract.setRewardFrequency(60 * 60 * 24 * 3)
        await stakingContract.setRewardPercent(1, 0)
        const stakeAmount = 100
        const stakeFrequency = await stakingContract.rewardFrequency()
        const stakePercent = await stakingContract.rewardPercent()
        const stakePercentAccuracy = await stakingContract.rewardPercentAccuracy()
        const stakeMaxTime = Number(await stakingContract.maxStakingTime())
        let claimedValue = 0
        const tx = await stakingContract.connect(account2).stake(stakeAmount)
        await tx.wait()

        await ethers.provider.send(
            "evm_increaseTime",
            [stakeMaxTime + 10]
        )

        const claimTx = await stakingContract.connect(account2).claim()
        await claimTx.wait()
        
        claimedValue = stakeAmount * stakePercent / 10 ** stakePercentAccuracy / 100 * stakeMaxTime / stakeFrequency
        expect(await rewardToken.balanceOf(account2.address)).to.eq(claimedValue)
        expect(await rewardToken.balanceOf(stakingContract.address)).to.eq(rewardTokensMintAmount - claimedValue)

    })

    it("stake after staking end", async () => {
        const stakingReachedLimitRevertedMessage = "staking has reached the limit"
        const stakeAmount = 1000
        const stakeMaxTime = Number(await stakingContract.maxStakingTime())
        const tx = await stakingContract.connect(account2).stake(stakeAmount)
        await tx.wait()

        await ethers.provider.send(
            "evm_increaseTime",
            [stakeMaxTime + 1000]
        )

        await expect(stakingContract.connect(account2).stake(stakeAmount)).to.be.revertedWith(stakingReachedLimitRevertedMessage)
    })

    it("claim with zero balance or zero reward", async () => {
        const zeroRewardRevertedMessage = "can not get reward"

        await expect(stakingContract.claim()).to.be.revertedWith(zeroRewardRevertedMessage)
    })

    it("unstake with zero balance", async () => {
        const zeroBalanceRevertedMessage = "staked 0 tokens"

        await expect(stakingContract.unstake()).to.be.revertedWith(zeroBalanceRevertedMessage)
    })

    it("unstake freezed tokens", async () => {
        const freezedTokensRevertedMessage = "tokens freezed"
        const stakeAmount = 1000
        await stakingContract.connect(account2).stake(stakeAmount)

        await expect(stakingContract.connect(account2).unstake()).to.be.revertedWith(freezedTokensRevertedMessage)
    })

    it("should set reward frequency", async () => {
        const newRewardFrequency = 30
        const oldRewardFrequency = Number(await stakingContract.rewardFrequency())

        if (newRewardFrequency === oldRewardFrequency) {
            throw new Error("new reward frequency and old frequency are equal")
        }

        const tx = await stakingContract.setRewardFrequency(newRewardFrequency)
        tx.wait()

        expect(await stakingContract.rewardFrequency()).to.eq(newRewardFrequency)
    })

    it("should set reward frequency only admin", async () => {
        const newRewardFrequency = 30
        const oldRewardFrequency = Number(await stakingContract.rewardFrequency())

        if (newRewardFrequency === oldRewardFrequency) {
            throw new Error("new reward frequency and old frequency are equal")
        }

        await expect(stakingContract.connect(account2).setRewardFrequency(newRewardFrequency)).to.be.revertedWith(notAdminRevertedMessage)
    })

    it("should set reward percent", async () => {
        const newRewardPercent = 255725
        const newRewardPercentAccuracy = 4
        const oldRewardPercent = Number(await stakingContract.rewardPercent())

        if (newRewardPercent === oldRewardPercent) {
            throw new Error("new reward percent and old percent are equal")
        }

        const tx = await stakingContract.setRewardPercent(newRewardPercent, newRewardPercentAccuracy)
        tx.wait()

        expect(await stakingContract.rewardPercent()).to.eq(newRewardPercent)
        expect(await stakingContract.rewardPercentAccuracy()).to.eq(newRewardPercentAccuracy)
    })

    it("should set reward percent only admin", async () => {
        const newRewardPercent = 255725
        const newRewardPercentAccuracy = 4
        const oldRewardPercent = Number(await stakingContract.rewardPercent())

        if (newRewardPercent === oldRewardPercent) {
            throw new Error("new reward percent and old percent are equal")
        }

        await expect(stakingContract.connect(account2).setRewardPercent(newRewardPercent, newRewardPercentAccuracy)).to.be.revertedWith(notAdminRevertedMessage)
    })

    it("should set freeze time", async () => {
        const newFreezeTime = 120
        const oldFreezeTime = Number(await stakingContract.freezeTime())

        if (newFreezeTime === oldFreezeTime) {
            throw new Error("new freeze time and old freeze time are equal")
        }
        await stakingContract.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DAO_ROLE")), gisDaoVoting.address)
        await stakingContract.connect(account2).stake(2000)
        await stakingContract.connect(account3).stake(3000)

        const iface = new ethers.utils.Interface([
            "function setFreezeTime(uint256 _freezeTime)"
        ])

        const calldata = iface.encodeFunctionData("setFreezeTime", [newFreezeTime])
        await gisDaoVoting.connect(chairman).addProposal(calldata, stakingContract.address, "set freeze time")

        await gisDaoVoting.connect(account2).vote(1, true)
        await gisDaoVoting.connect(account3).vote(1, true)

        await ethers.provider.send(
            "evm_increaseTime",
            [1000]
        );

        const tx = await gisDaoVoting.finish(1)
        expect(await stakingContract.freezeTime()).to.eq(newFreezeTime)
    })

    it("should set freeze time only dao", async () => {
        const newFreezeTime = 120
        const oldFreezeTime = Number(await stakingContract.freezeTime())

        if (newFreezeTime === oldFreezeTime) {
            throw new Error("new freeze time and old freeze time are equal")
        }

        await expect(stakingContract.connect(account2).setFreezeTime(newFreezeTime)).to.be.revertedWith("available only dao")
    })

    it("should set max staking time", async () => {
        const newMaxStakingTime = 50
        const oldMaxStakingTime = Number(await stakingContract.maxStakingTime())

        if(newMaxStakingTime === oldMaxStakingTime){
            throw new Error("new max staking time and old time are equal")
        }

        const tx = await stakingContract.setMaxStakingTime(newMaxStakingTime)
        tx.wait()

        expect(await stakingContract.maxStakingTime()).to.eq(newMaxStakingTime)
    })

    it("should set max staking time only admin", async () => {
        const newMaxStakingTime = 50
        const oldMaxStakingTime = Number(await stakingContract.maxStakingTime())

        if(newMaxStakingTime === oldMaxStakingTime){
            throw new Error("new max staking time and old time are equal")
        }

        await expect(stakingContract.connect(account2).setMaxStakingTime(newMaxStakingTime)).to.be.revertedWith(notAdminRevertedMessage)
    })

    it("setDaoContract reverts",async () => {
        await expect(stakingContract.connect(account2).setDaoContract(ethers.constants.AddressZero)).to.be.revertedWith("not an owner")
        await expect(stakingContract.setDaoContract(ethers.constants.AddressZero)).to.be.revertedWith("zero address")
    })
})