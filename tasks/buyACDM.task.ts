import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/ACDMPlatform.sol/ACDMPlatform.json'


task("buy-acdm", "Buy ACDM token on sale")
    .addParam("contract", "Contract address")
    .addParam("ethAmount", "ETH amount to spend")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const ethAmount = taskArgs.ethAmount
        const acdmPlatform = new ethers.Contract(
            contract,
            abi,
            signer
        )

        const tx = await acdmPlatform.buyACDM({value: ethAmount})
        console.log(tx)
    })