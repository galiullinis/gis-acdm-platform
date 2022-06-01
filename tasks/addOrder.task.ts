import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/ACDMPlatform.sol/ACDMPlatform.json'


task("add-order", "Add order on the trade round")
    .addParam("contract", "Contract address")
    .addParam("amount", "Amount of the tokens")
    .addParam("price", "Price of the 1 token (Currency: ETH)")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const amount = taskArgs.amount
        const price = taskArgs.price
        const acdmPlatform = new ethers.Contract(
            contract,
            abi,
            signer
        )

        const tx = await acdmPlatform.addOrder(amount, price)
        console.log(tx)
    })