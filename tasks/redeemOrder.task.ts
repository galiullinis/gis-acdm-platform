import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/ACDMPlatform.sol/ACDMPlatform.json'


task("redeem-order", "Redeem some of the tokens")
    .addParam("contract", "Contract address")
    .addParam("ethAmount", "ETH amount to spend")
    .addParam("orderId", "ID of the order")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const ethAmount = taskArgs.ethAmount
        const orderId = taskArgs.orderId
        const acdmPlatform = new ethers.Contract(
            contract,
            abi,
            signer
        )

        const tx = await acdmPlatform.redeemOrder(orderId, {value: ethAmount})
        console.log(tx)
    })