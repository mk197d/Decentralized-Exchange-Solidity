async function runDexSimulation() {
    try {
        console.log("Starting DEX simulation...");

        const dexMetadata = JSON.parse(await remix.call('fileManager', 'getFile', 'browser/artifacts/DEX.json'));
        const tokenAMetadata = JSON.parse(await remix.call('fileManager', 'getFile', 'browser/artifacts/TokenA.json'));
        const tokenBMetadata = JSON.parse(await remix.call('fileManager', 'getFile', 'browser/artifacts/TokenB.json'));
        
        const dexABI = dexMetadata.abi;
        const tokenABI = tokenAMetadata.abi;
        const tokenBBI = tokenBMetadata.abi;

        const accounts = await web3.eth.getAccounts();
        const LPs = accounts.slice(1, 6);
        const traders = accounts.slice(6, 14);

        const tokenAAddress = "0x71bE66279680091d30C168e659E69D4261F3A90b"; // Replace with your address
        const tokenBAddress = "0x98478EF826840ACaD3aBd16181FA461a7977cc25"; // Replace with your address
        const dexAddress = "0x3C8f8111EdC7f1A58e5453BC294D9A0b49e25830"; // Replace with your address

        const tokenA = new web3.eth.Contract(tokenABI, tokenAAddress);
        const tokenB = new web3.eth.Contract(tokenBBI, tokenBAddress);
        const dex = new web3.eth.Contract(dexABI, dexAddress);


        // For distributing the swap fees
        async function distributeToLPs(amountA, amountB) {
            try {                
                // Get LP token contract
                const lpTokenAddress = await dex.methods.lpToken().call();
                const lpTokenContract = new web3.eth.Contract(tokenABI, lpTokenAddress);
                
                let totalLPTokens = 0;
                const lpBalances = [];
                
                for (let i = 0; i < LPs.length; i++) {
                    const lpBalance = parseInt(await lpTokenContract.methods.balanceOf(LPs[i]).call());
                    lpBalances.push(lpBalance);
                    totalLPTokens += lpBalance;
                }
                
                // Distribute tokens proportionally based on LP token holdings
                if (totalLPTokens > 0) {
                    for (let i = 0; i < LPs.length; i++) {
                        const lpShare = lpBalances[i] / totalLPTokens;
                        const lpAmountA = Math.floor(amountA * lpShare);
                        const lpAmountB = Math.floor(amountB * lpShare);
                        
                        if (lpAmountA > 0) {
                            await tokenA.methods.transfer(LPs[i], lpAmountA).send({ from: accounts[0] });
                        }
                        
                        if (lpAmountB > 0) {
                            await tokenB.methods.transfer(LPs[i], lpAmountB).send({ from: accounts[0] });
                        }
                    }
                }
                                
            } catch (err) {
                console.error("Distribution Error:", err);
            }
        }
        window.distributeToLPs = async (amountA, amountB, proportional) => {
            return await distributeToLPs(amountA, amountB, proportional);
        };


        ////////////////////////////////// CONSTANTS & INITIALIZATON //////////////////////////////////////////
        const top_up_trader = 100;
        const initTokenA = 40 * (10 ** 10);
        const initTokenB = 80 * (10 ** 10);

        for(let i = 0; i < LPs.length; i++) {
            let currLP = LPs[i];

            let initA = Math.floor(Math.random() * initTokenA);
            let initB = Math.floor(Math.random() * initTokenB);

            await tokenA.methods.transfer(currLP, initA).send({ from: accounts[0] });
            await tokenB.methods.transfer(currLP, initB).send({ from: accounts[0] });
        }
        //////////////////////////////////////////////////////////////////////////////////////////////////////
        
        const N = Math.floor(Math.random() * 51) + 50; // Random N ∈ [50, 100]
        
        let swap_amountA = 0, swap_amountB = 0, reserves;        
        for (let i = 0; i < N; i++) {
            console.log("------------------------------------------");
            console.log("Iteration: " + i);
            reserves = await dex.methods.getReserves().call();
            console.log(reserves[0] / 1e10, reserves[1] / 1e10);
            console.log(". . . . . . . . . . . . . . . . . . . . . .");

            const isLP = Math.random() < 0.384615;      // ~ 5/13

            let actor; 
            let frac_index = Math.random();
            if(isLP) {
                let LP_index = Math.floor(frac_index * LPs.length);
                actor = LPs[LP_index];

            } else {
                let trader_index = Math.floor(frac_index * traders.length);
                actor = traders[trader_index];

            }

            let actionType;
            if(isLP) actionType = ["addLiquidity", "removeLiquidity"][Math.floor(Math.random() * (1.999999999999))];
            else     actionType = ["swapAforB", "swapBforA"][Math.floor(Math.random() * (1.999999999999))];

            let amountA = 0, amountB = 0, amountAOut = 0, amountBOut = 0;
            try {
                reserves = await dex.methods.getReserves().call();
                let reserveA = parseInt(reserves[0]);
                let reserveB = parseInt(reserves[1]);

                const balanceA = parseInt(await tokenA.methods.balanceOf(actor).call());
                const balanceB = parseInt(await tokenB.methods.balanceOf(actor).call());

                let lpBalance = 0;
                if (isLP) {
                    const lpTokenAddress = await dex.methods.lpToken().call();
                    const lpTokenContract = new web3.eth.Contract(tokenABI, lpTokenAddress);
                    const rawBalance = await lpTokenContract.methods.balanceOf(actor).call();
                    lpBalance = parseInt(rawBalance);
                }

                if (actionType === "swapAforB") {
                    console.log("Action: " + actionType);
                    
                    const topUpAmount = Math.floor(Math.random() * top_up_trader * (10 ** 10));
                    await tokenA.methods.transfer(actor, topUpAmount).send({ from: accounts[0] });

                    const updatedBalanceA = parseInt(await tokenA.methods.balanceOf(actor).call());
                    amountA = Math.floor(Math.random() * Math.min(updatedBalanceA, reserveA / 10));

                    if (amountA > 0) 
                    {   
                        await tokenA.methods.approve(dexAddress, amountA).send({ from: actor });
                        await dex.methods.swapAforB(amountA).send({ from: actor });
                    }

                    swap_amountA += amountA / 1e10;

                    let reserves_after_swap = await dex.methods.getReserves().call();
                    let reserveB_after_swap = parseInt(reserves_after_swap[1]);
                    amountBOut = reserveB - reserveB_after_swap;

                    // Distributing fees to LPs
                    let expectedB = (((amountA / 1e10) * reserveB) / (reserveA + amountA)) * 1e10;
                    let feeB = expectedB - amountBOut;
                    distributeToLPs(0, feeB);
                }

                if (actionType === "swapBforA") {
                    console.log("Action: " + actionType);
                    
                    const topUpAmount = Math.floor(Math.random() * top_up_trader * (10 ** 10));
                    await tokenB.methods.transfer(actor, topUpAmount).send({ from: accounts[0] });

                    const updatedBalanceB = parseInt(await tokenA.methods.balanceOf(actor).call());
                    amountB = Math.floor(Math.random() * Math.min(updatedBalanceB, reserveB / 10));

                    if (amountB > 0) {
                        await tokenB.methods.approve(dexAddress, amountB).send({ from: actor });
                        await dex.methods.swapBforA(amountB).send({ from: actor });
                    }

                    swap_amountB += amountB / 1e10;

                    let reserves_after_swap = await dex.methods.getReserves().call();
                    let reserveA_after_swap = parseInt(reserves_after_swap[0]);
                    amountAOut = reserveA - reserveA_after_swap;

                    // Distributing fees to LPs
                    let expectedA = (((amountB / 1e10) * reserveA) / (reserveB + amountB)) * 1e10;
                    let feeA = expectedA - amountAOut;
                    distributeToLPs(feeA, 0);
                }

                if (actionType === "addLiquidity" && isLP) {                    
                    console.log("Action: " + actionType);

                    amountA = Math.floor(Math.random() * balanceA);
                    amountB = Math.floor((((amountA / 1e10) * balanceB) / balanceA) * (10 ** 10));
                    
                    if (amountA > 0 && amountB > 0 && balanceB >= amountB) {
                        await tokenA.methods.approve(dexAddress, amountA).send({ from: actor });
                        await tokenB.methods.approve(dexAddress, amountB).send({ from: actor });
                        
                        await dex.methods.addLiquidity(amountA, amountB).send({ from: actor });
                    }
                     
                }

                if (actionType === "removeLiquidity" && isLP && lpBalance > 0) {
                    console.log("Action: " + actionType);
            
                    const amountLP = Math.floor(Math.random() * lpBalance);
                    if (amountLP > 0) 
                        await dex.methods.removeLiquidity(amountLP).send({ from: actor });
                }

                ////////////////// Metrics Calculation ///////////////////////////////////////////////////////////
                
                // Liquidity
                const finalReserves = await dex.methods.getReserves().call();
                const finalReserveA = parseFloat(finalReserves[0]);
                const finalReserveB = parseFloat(finalReserves[1]);

                const spotPriceAperB = await dex.methods.getSpotPriceAperB().call(); // tokenB/tokenA
                const priceBinUSD = parseFloat(spotPriceAperB) / 1e10;
                const TVL = (finalReserveA + finalReserveB * priceBinUSD) / (1e10);

                const reserve_ratio = finalReserveA / finalReserveB;

                console.log("TVL: " + TVL);
                console.log(`Reserve Ratio: ${reserve_ratio.toFixed(4)}`);

                // Price Dynamics
                if (actionType === "swapAforB" && amountA > 0) {
                    const actualRate = amountBOut / amountA;
                    const expectedRate = reserveB / reserveA;
                    const slippage = ((actualRate - expectedRate) / expectedRate) * 100;
                    console.log(`Slippage (A for B): ${slippage.toFixed(4)}%`);

                    const swapExchange = amountA / amountBOut;
                    console.log(`Swap Exchange (A / B): ${swapExchange.toFixed(6)}`);

                    // Slippage v/s Trade lot Fraction
                    const trade_lot_fraction = amountA / reserveA;
                    console.log(`Trade Lot Fraction:  ${trade_lot_fraction.toFixed(6)}`);
                }

                if (actionType === "swapBforA" && amountB > 0) {
                    const actualRate = amountAOut / amountB;
                    const expectedRate = reserveA / reserveB;
                    const slippage = ((actualRate - expectedRate) / expectedRate) * 100;
                    console.log(`Slippage (B for A): ${slippage.toFixed(4)}%`);

                    const swapExchange = amountAOut / amountB;
                    console.log(`Swap Exchange (A / B): ${swapExchange.toFixed(6)}`);

                    // Slippage v/s Trade lot Fraction
                    const trade_lot_fraction = amountB/ reserveB;
                    console.log(`Trade Lot Fraction:  ${trade_lot_fraction.toFixed(6)}`);
                }

                // Trading Activity
                console.log(`TokenA swapped: ${swap_amountA.toFixed(4)}`);
                console.log(`TokenB swapped: ${swap_amountB.toFixed(4)}`);

                const feeAccumulated = await dex.methods.getFee().call();
                const feeA = parseFloat(feeAccumulated[0] / 1e10);
                const feeB = parseFloat(feeAccumulated[1] / 1e10);
                console.log(`FeeA: ${feeA.toFixed(6)}`);
                console.log(`FeeB: ${feeB.toFixed(6)}`);

                //////////////////////////////////////////////////////////////////////////////////////////////////

            } catch (err) {
                console.log(`Iteration ${i} failed: ${err.message}`);
                continue;
            }
        }

        /////////////////////////////// Holding across liquidity providers ///////////////////////////////////////
        const lpTokenAddress = await dex.methods.lpToken().call();
        const lpTokenContract = new web3.eth.Contract(tokenABI, lpTokenAddress);

        for (let i = 0; i < LPs.length; i++) {
            const lp = LPs[i];
            let balanceA = await tokenA.methods.balanceOf(lp).call();
            balanceA = balanceA / (1e10);
            let balanceB = await tokenB.methods.balanceOf(lp).call();
            balanceB = balanceB / (1e10);
            let lpTokens = await lpTokenContract.methods.balanceOf(lp).call();
            lpTokens = lpTokens / (1e10);
            console.log(`LP ${i + 1}: TokenA = ${balanceA}, TokenB = ${balanceB}, LP Tokens = ${lpTokens}`);
        }
        //////////////////////////////////////////////////////////////////////////////////////////////////////////

    } catch (err) {
        console.error("Simulation Error:", err);
    }
}

runDexSimulation();