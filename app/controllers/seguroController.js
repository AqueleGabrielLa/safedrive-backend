// processarEPagarSinistro 
// apoliceEstaPaga retirarFundos

const { ethers } = require('ethers');
const contract = require('../server.js');
const { format } = require('date-fns');

module.exports = {
    async cadastrarSegurado(req, res) {
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

            if (valorPremio <= 0 || valorCobertura <= 0 || prazo <= 0) {
                return res.status(400).json({
                    error: 'Os valores de prêmio, cobertura e prazo devem ser positivos.'
                });
            }
            
            const valorPremioWei = ethers.parseEther(valorPremio.toString()).toString();
            const valorCoberturaWei = ethers.parseEther(valorCobertura.toString()).toString();

            const tx = await contract.criarApolice(
                endereco,
                tipo,
                valorPremioWei,
                valorCoberturaWei,
                prazo
            );
            const receipt = await tx.wait();
            const idApolice = receipt.logs[0].args[0].toString();
            
            res.json({
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                idApolice: idApolice
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

            if (isNaN(valor) || valor <= 0) {
                return res.status(400).json({ error: 'Valor do prêmio inválido.' });
            }

            const valorWei = ethers.parseEther(valor.toString());

            const tx = await contract.pagarPremio(idApolice, { value: valorWei });
            const receipt = await tx.wait();

            const log = receipt.logs[0];
    
            const [ valorPago ] = log.args[1].toString();

            res.json({
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                idApolice: idApolice,
                valorPago: valorPago
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    async registrarSinistro(req, res) {
        try {
            const { idApolice } = req.params;
            const { descricao, valorPedido } = req.body;
    
            if (isNaN(valorPedido) || valorPedido <= 0) {
                return res.status(400).json({ error: 'Valor do pedido inválido.' });
            }
    
            const tx = await contract.registrarSinistro(idApolice, descricao, valorPedido);
            const receipt = await tx.wait();

            const log = receipt.logs[0];
    
            const [idSinistro, idApoliceEvento] = log.args;
    
            res.json({
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                idSinistro: idSinistro.toString(),
                idApolice: idApoliceEvento.toString(), 
                descricao: descricao,
                valorPedido: valorPedido
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    async processarEPagarSinistro(req, res) {
        try {
            const { idSinistro } = req.params;
            const { aprovado } = req.body;
    
            if (typeof aprovado !== 'boolean') {
                return res.status(400).json({ error: 'Parâmetro "aprovado" deve ser um booleano.' });
            }

            const saldoContrato = await contract.saldoContrato();
            const sinistro = await contract.sinistros(idSinistro);
            if (aprovado && saldoContrato < sinistro.valorPedido) {
                return res.status(400).json({ error: 'Saldo insuficiente no contrato para pagar o sinistro.' });
            }

            const tx = await contract.processarEPagarSinistro(idSinistro, aprovado);

            const receipt = await tx.wait();
    
            const log = receipt.logs[0];
    
            const [idSinistroEvento, aprovadoEvento] = log.args;

            const idSinistroStr = idSinistroEvento.toString();
            const aprovadoStr = aprovadoEvento ? true : false;
    
            res.json({
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                idSinistro: idSinistroStr,
                aprovado: aprovadoStr
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
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

    async consultarApoliceBase(req, res) {
        try {
            const { idApolice } = req.params;
    
            const apolice = await contract.consultarApoliceBase(idApolice);
    
            const [segurado, tipoSeguro, valorPremio, valorCobertura] = apolice;
    
            const valorPremioFormatado = ethers.formatUnits(valorPremio, "wei");
            const valorCoberturaFormatado = ethers.formatUnits(valorCobertura, "wei");

            res.json({
                success: true,
                segurado: segurado,
                tipoSeguro: tipoSeguro,
                valorPremio: valorPremioFormatado,
                valorCobertura: valorCoberturaFormatado
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    async consultarApoliceStatus(req, res) {
        try {
            const { idApolice } = req.params;
    
            const status = await contract.consultarApoliceStatus(idApolice);
    
            const [dataInicio, dataFim, ativa, paga] = status;
    
            const dataInicioFormatada = new Date(Number(dataInicio) * 1000).toISOString();
            const dataFimFormatada = new Date(Number(dataFim) * 1000).toISOString();
    
            res.json({
                success: true,
                idApolice,
                dataInicio: dataInicioFormatada,
                dataFim: dataFimFormatada,
                ativa,
                paga
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
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