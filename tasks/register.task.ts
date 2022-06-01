import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/ACDMPlatform.sol/ACDMPlatform.json'


task("register", "Registration on the ACDM platform")
    .addParam("contract", "Contract address")
    .addOptionalParam("refferer", "Refferer address if exists")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const refferer = taskArgs.refferer
        const acdmPlatform = new ethers.Contract(
            contract,
            abi,
            signer
        )

        let tx;

        if (refferer === undefined){
            tx = await acdmPlatform["register()"]()
        } else {
            tx = await acdmPlatform["register(address)"](refferer)
        }
        console.log(tx)
    })