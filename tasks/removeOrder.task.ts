import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/ACDMPlatform.sol/ACDMPlatform.json'


task("remove-order", "Remove order from the trade")
    .addParam("contract", "Contract address")
    .addParam("orderId", "ID of the order")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const orderId = taskArgs.orderId
        const acdmPlatform = new ethers.Contract(
            contract,
            abi,
            signer
        )

        const tx = await acdmPlatform.removeOrder(orderId)
        console.log(tx)
    })