//cadastrarSegurado, consultarSegurado, saldoContrato
// criarApolice, pagarPremio registrarSinistro

// processarEPagarSinistro 
// consultarApoliceBase consultarApoliceStatus 
// apoliceEstaPaga retirarFundos
const { ethers } = require('ethers');
const contract = require('../server.js');
const { format } = require('date-fns');

const helper = {
    async error(error){
        console.error('Erro ao cadastrar segurado:', error);
            res.status(500).json({
            error: 'Erro ao cadastrar segurado',
            details: error.message
        });
    }
}

module.exports = {
    async cadastrarSegurado(req, res) {
        console.log("Recebendo requisição JSON-RPC...");
    
        const { jsonrpc, method, params, id } = req.body;
    
        // Validar se o formato JSON-RPC está correto
        if (jsonrpc !== '2.0' || method !== 'cadastrarSegurado' || !Array.isArray(params)) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32600,
                    message: 'Invalid Request',
                },
                id: id || null,
            });
        }
    
        try {
            const [endereco, nome, documento] = params;
            if (!endereco || !nome || !documento) {
                return res.status(400).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32602,
                        message: 'Dados incompletos. Forneça endereço, nome e documento.',
                    },
                    id,
                });
            }
            
            const tx = await contract.cadastrarSegurado(endereco, nome, documento);
            const receipt = await tx.wait();
    
            return res.json({
                jsonrpc: '2.0',
                result: {
                    success: true,
                    transactionHash: tx.hash,
                    blockNumber: receipt.blockNumber,
                },
                id,
            });
        } catch (error) {
            console.error("Erro no método cadastrarSegurado:", error);
            return res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Erro interno do servidor.',
                    data: error.message,
                },
                id,
            });
        }
    },

    // Criar nova apólice
    async criarApolice(req, res) {
        try {
            const { endereco, tipo, valorPremio, valorCobertura, prazo } = req.body;
            
            if(!endereco || !tipo || !valorCobertura || !valorPremio || !prazo){
                return res.status(400).json({ 
                    error: 'Dados incompletos. Forneça endereço, nome e documento.' 
                });
            }

            if (isNaN(valorPremio) || isNaN(valorCobertura) || isNaN(prazo)) {
                return res.status(400).json({
                    error: 'Valor de prêmio, cobertura e prazo devem ser numéricos.'
                });
            }
            
            const valorPremioWei = ethers.utils.parseEther(valorPremio.toString());
            const valorCoberturaWei = ethers.utils.parseEther(valorCobertura.toString());

            const tx = await contract.criarApolice(
                endereco,
                tipo,
                valorPremioWei,
                valorCoberturaWei,
                prazo
            );
            const receipt = await tx.wait();
            // const idApolice = receipt.logs[0].args[0];
            // console.log(`Apolice criada com ID: ${idApolice}`);
            console.log(receipt.logs);
            
            res.json({
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Realizar pagamento de prêmio
    async pagarPremio(req, res) {
        try {
            const { idApolice } = req.params;
            const { valor } = req.body;

            const tx = await contract.pagarPremio(idApolice, {
                value: parseEther(valor.toString())
            });
            const receipt = await tx.wait();

            res.json({
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber
            });
        } catch (error) {
            helper.error(error);
        }
    },

    async registrarSinistro(req, res) {
        try {
            const { idApolice } = req.params;
            const {descricao, valor} = req.body;

            const tx = await contract.registrarSinistro(idApolice, descricao, valor);
            const receipt = await tx.wait();

            res.json({
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber
            });
        } catch (error) {
            helper.error(error);
        }
    },

    async consultarSegurado(req, res) {
        try {
            const endereco = req.params.endereco;
            
            const segurado = await contract.consultarSegurado(endereco);
            const dataCadastroFormatada = format(new Date(Number(segurado[3]) * 1000), 'dd/MM/yyyy HH:mm:ss');
            res.json({
                nome: segurado[0],
                documento: segurado[1],
                ativo: segurado[2],
                dataCadastro: dataCadastroFormatada
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async saldoContrato(req, res) {
        try {
            const saldoBigInt = await contract.saldoContrato();
            const saldo = saldoBigInt.toString();
            res.json({ saldo });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}