async function runArbitrageSimulation() {
    try {
        console.log("Starting Arbitrage Simulation...");

        const arbitrageMetadata = JSON.parse(await remix.call('fileManager', 'getFile', 'browser/artifacts/Arbitrage.json'));
        const dexMetadata = JSON.parse(await remix.call('fileManager', 'getFile', 'browser/artifacts/DEX.json'));

        const arbitrageABI = arbitrageMetadata.abi;
        const dexABI = dexMetadata.abi;

        const accounts = await web3.eth.getAccounts();
        const arbitrageur = accounts[0];

        // Replace with your deployed contract addresses
        const dex1Address = "0xa043CADBA3C83782616CcE7d2a75137fbf3D0865";
        const dex2Address = "0xf23DAe49797B7eebe483A8113a6CAE5000e40a30";
        const arbitrageAddress = "0xFa7f2a95445325DDE17C3766552126285c246306";

        const arbitrage = new web3.eth.Contract(arbitrageABI, arbitrageAddress);
        const dex1 = new web3.eth.Contract(dexABI, dex1Address);
        const dex2 = new web3.eth.Contract(dexABI, dex2Address);

        reserves1 = await dex1.methods.getReserves().call();
        reserves2 = await dex2.methods.getReserves().call();

        reserves1["0"] = reserves1["0"] / 1e10;
        reserves1["1"] = reserves1["1"] / 1e10;
        reserves2["0"] = reserves2["0"] / 1e10;
        reserves2["1"] = reserves2["1"] / 1e10;

        console.log("DEX 1 Reserves:", reserves1);
        console.log("DEX 2 Reserves:", reserves2);

        const spot1 = await dex1.methods.getSpotPriceBperA().call();
        const spot2 = await dex2.methods.getSpotPriceBperA().call();

        console.log(`Spot Price DEX1 (B/A): ${spot1 / 1e10} | DEX2 (B/A): ${spot2 / 1e10}`);

        const amountIn = 50000;
        const minProfitThreshold = 1000;

        // Try A → B → A
        console.log("\n🔁 Trying A → B → A arbitrage...");
        try {
            await arbitrage.methods.executeAtoBtoAarbitrage(amountIn, minProfitThreshold).send({ from: arbitrageur });
            console.log("✅ A → B → A arbitrage executed successfully.");
        } catch (err) {
            console.log("❌ A → B → A arbitrage failed:", err.message);
        }

        // // Try B → A → B
        // console.log("\n🔁 Trying B → A → B arbitrage...");
        // try {
        //     await arbitrage.methods.executeBtoAtoBarbitrage(amountIn, minProfitThreshold).send({ from: arbitrageur });
        //     console.log("✅ B → A → B arbitrage executed successfully.");
        // } catch (err) {
        //     console.log("❌ B → A → B arbitrage failed:", err.message);
        // }

    } catch (err) {
        console.error("Simulation Error:", err.message);
    }
}

runArbitrageSimulation();