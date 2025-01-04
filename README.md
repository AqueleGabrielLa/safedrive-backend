# Backend da aplicação de seguros na blockchain

`npx hardhat localhost` - inicia a blockchain local

em outro terminal:
`npx hardhat run ignition/modules/deploy.js --network localhost` - dá deploy no contrato na blockchain
`node app/server.js` - inicia o servidor local, conectando a rota localhost:3000 a blockchain

http://localhost:3000/api/

URL principal das rotas. rotas estão no arquivo no app/routes/seguroRoutes.js