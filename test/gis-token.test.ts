import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("GisToken", () => {
    const tokenName = "GisToken"
    const tokenSymbol = "GIS"
    let owner;
    let account2: SignerWithAddress;
    let account3: SignerWithAddress;
    let minter: SignerWithAddress;
    let burner: SignerWithAddress;
    let gisToken: Contract;

    it("deploy with empty name and symbol", async () => {
        const emptyNameRevertedMessage = "incorrect params.";
        [owner, account2, account3] = await ethers.getSigners();
        const GisToken = await ethers.getContractFactory("GisToken", owner);
        await expect(GisToken.deploy('', '', 0)).to.be.revertedWith(emptyNameRevertedMessage);
    })

    beforeEach(async () => {
        [owner, account2, account3, minter, burner] = await ethers.getSigners();
        const GisToken = await ethers.getContractFactory("GisToken", owner);
        gisToken = await GisToken.deploy(tokenName, tokenSymbol, 18);
        await gisToken.deployed();  
    })

    it("should be correct name and symbol after depoy", async () => {
        expect(await gisToken.name()).to.eq(tokenName);
        expect(await gisToken.symbol()).to.eq(tokenSymbol);
    })

    it("should mint only minter", async () => {
        const notAnOwnerRevertedMessage = "you are not a minter";
        await expect(gisToken.connect(account2).mint(account2.address, 1000)).to.be.revertedWith(notAnOwnerRevertedMessage);
    })

    it("should burn only burner", async () => {
        const notAnOwnerRevertedMessage = "you are not a burner";
        await expect(gisToken.connect(account2).burn(account2.address, 1000)).to.be.revertedWith(notAnOwnerRevertedMessage);
    })

    describe("approves and allowances", () => {
        const approvalAmount = 50000

        it("approve reverts check: equal addresses", async () => {
            const equalAddressesRevertedMessage = "owner and spender adresses are equal."
            await expect(gisToken.connect(account2).approve(account2.address, approvalAmount)).to.be.revertedWith(equalAddressesRevertedMessage)
        })

        it("approve reverts check: spender zero address", async () => {
            const spenderZeroAddressRevertedMessage = "spender address should not be the zero address."
            await expect(gisToken.connect(account2).approve(ethers.constants.AddressZero, approvalAmount)).to.be.revertedWith(spenderZeroAddressRevertedMessage)
        })
    
        it("approve and allowance test", async () => {            
            const tx = await gisToken.connect(account2).approve(account3.address, approvalAmount);
            await tx.wait()
            expect(await gisToken.allowance(account2.address, account3.address)).to.eq(approvalAmount)
            expect(tx).to.emit(gisToken, "Approval").withArgs(account2.address, account3.address, approvalAmount)
        })
    })
    

    describe("transfers", () => {
        const mintAmount = 50000

        beforeEach(async () => {
            await gisToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), minter.address)
            await gisToken.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BURNER_ROLE")), burner.address)
            const tx = await gisToken.connect(minter).mint(account2.address, mintAmount)
            await tx.wait()
        })

        it("should not be possible to send tokens to the zero address", async () => {
            const transferAmount = 5000
            const zeroAddressRevertedMessage = "try to send tokens to the zero address."
            const tx = gisToken.connect(account2).transfer(ethers.constants.AddressZero, transferAmount)
            await expect(tx).to.be.revertedWith(zeroAddressRevertedMessage)
        })

        it("not enough balance check", async () => {
            const incorrectAmount = 5000000
            const notEnoughBalanceRevertedMessage = "not enough tokens on sender balance."
            const tx = gisToken.connect(account2).transfer(account3.address, incorrectAmount)
            await expect(tx).to.be.revertedWith(notEnoughBalanceRevertedMessage)
        })

        it("should be correct totalSupply and account balance after minting", async () => {
            expect(await gisToken.totalSupply()).to.eq(mintAmount)
            expect(await gisToken.balanceOf(account2.address)).to.eq(mintAmount)
        })

        it("mint to the zero address", async () => {
            const zeroAddressRevertedMessage = "account should not be the zero address."
            await expect(gisToken.mint(ethers.constants.AddressZero, 1000)).to.be.revertedWith(zeroAddressRevertedMessage)
        })

        it("mint with zero amount", async () => {
            const zeroAmountRevertedMessage = "amount should not be zero."
            await expect(gisToken.mint(account2.address, 0)).to.be.revertedWith(zeroAmountRevertedMessage)
        })

        it("should not be possible to burn amount larger than account balance", async () => {
            const notBurnableRevertedMessage = "burn amount larger than account balance."
            await expect(gisToken.connect(burner).burn(account2.address, 60000)).to.be.revertedWith(notBurnableRevertedMessage)
        })


        it("check events after mint and burn", async () => {
            const amount = 1000

            const mintTx = await gisToken.connect(minter).mint(account2.address, amount)
            await mintTx.wait()
            expect(mintTx).to.emit(gisToken, "Transfer").withArgs(ethers.constants.AddressZero, account2.address, amount)

            const burnTx = await gisToken.connect(burner).burn(account2.address, amount)
            await burnTx.wait()
            expect(burnTx).to.emit(gisToken, "Transfer").withArgs(account2.address, ethers.constants.AddressZero, amount)
        })

        it("token transfer from account to another", async () => {
            const transferAmount = 5000
            const tx = await gisToken.connect(account2).transfer(account3.address, transferAmount)
            await tx.wait()
            expect(await gisToken.balanceOf(account2.address)).to.eq(mintAmount - transferAmount)
            expect(await gisToken.balanceOf(account3.address)).to.eq(transferAmount)
            expect(tx).to.emit(gisToken, "Transfer").withArgs(account2.address, account3.address, transferAmount)
        })

        describe("transferFrom method checks", () => {
            const approvalAmount = 10000

            beforeEach(async () => {
                const tx = await gisToken.connect(account2).approve(account3.address, approvalAmount);
                await tx.wait()
            })

            it("transferFrom with incorrect allowance value", async () => {
                const incorrectAmount = 15000
                const incorrectAllowanceValueRevertedMessage = "incorrect allowance."
                
                const transferFromTx = gisToken.connect(account3).transferFrom(account2.address, account3.address, incorrectAmount)
                await expect(transferFromTx).to.be.revertedWith(incorrectAllowanceValueRevertedMessage)
            })
    
            it("method transferFrom check", async () => {
                const transferAmount = 5000

                const transferFromTx = await gisToken.connect(account3).transferFrom(account2.address, account3.address, transferAmount)
                await transferFromTx.wait()
    
                expect(await gisToken.balanceOf(account2.address)).to.eq(mintAmount - transferAmount)
                expect(await gisToken.balanceOf(account3.address)).to.eq(transferAmount)
                expect(await gisToken.allowance(account2.address, account3.address)).to.eq(approvalAmount - transferAmount)
            })
        })
    })

})