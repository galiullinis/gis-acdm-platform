import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/ACDMPlatform.sol/ACDMPlatform.json'


task("start-trade", "Start trade round")
    .addParam("contract", "Contract address")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const acdmPlatform = new ethers.Contract(
            contract,
            abi,
            signer
        )

        const tx = await acdmPlatform.startTradeRound()
        console.log(tx)
    })