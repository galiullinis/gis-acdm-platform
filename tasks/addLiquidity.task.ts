import { task } from 'hardhat/config'
import { abi } from '../abi/UniswapV2Router02.abi.json'


task("add-liquidity", "add liquidity to Uniswap.")
    .addParam("token", "A pool token address")
    .addParam("amountTokenDesired", "The amount of token to add as liquidity if the WETH/token price is <= msg.value/amountTokenDesired (token depreciates).")
    .addParam("amountTokenMin", "	Bounds the extent to which the WETH/token price can go up before the transaction reverts. Must be <= amountTokenDesired.")
    .addParam("amountEthDesired", "The amount of ETH to add as liquidity.")
    .addParam("amountEthMin", "Bounds the extent to which the token/WETH price can go up before the transaction reverts. Must be <= msg.value.")
    .addParam("to", "Recipient of the liquidity tokens.")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const poolToken = taskArgs.token
        const amountTokenDesired = taskArgs.amountTokenDesired
        const amountTokenMin = taskArgs.amountTokenMin
        const amountETHMin = taskArgs.amountEthMin
        const amountEthDesired = taskArgs.amountEthDesired
        const to = taskArgs.to
        const deadline = Date.now() + 15
        const routerAddress: any = process.env.UNISWAP_ROUTERV2_ADDRESS

        const uniswapRouter = new ethers.Contract(
            routerAddress,
            abi,
            signer
        )

        const tx = await uniswapRouter.addLiquidityETH(
            poolToken,
            amountTokenDesired,
            amountTokenMin,
            amountETHMin,
            to,
            deadline,
            {value: amountEthDesired}
        )
        console.log(tx)
    })