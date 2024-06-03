const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const amqp = require('amqplib');

// Connexion à RabbitMQ
const connect = async () => {
    try {
        const connection = await amqp.connect('amqp://rabbitmq');
        const channel = await connection.createChannel();
        return channel;
    } catch (error) {
        console.error('Error connecting to RabbitMQ', error);
    }
}

// Publier un message pour mettre à jour le stock des produits
const publishMessage = async (productId, quantity) => {
    try {
        const channel = await connect();
        await channel.assertQueue('product_stock');
        const message = {
            productId: productId,
            quantity: quantity
        };
        channel.sendToQueue('product_stock', Buffer.from(JSON.stringify(message)));
        console.log(`Message published to decrement stock for product ${productId}`);
    } catch (error) {
        console.error('Error publishing message', error);
    }
}

// Créer une nouvelle commande
router.post('/', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.status(201).send(order);

        // Publier un message pour décrémenter le stock des produits de la commande
        for (const product of order.products) {
            await publishMessage(product._id, product.quantity);
        }
    } catch (error) {
        res.status(400).send(error);
    }
});


// Lire toutes les commandes
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find();
        res.status(200).send(orders);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Lire une commande par ID
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).send();
        }
        res.status(200).send(order);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Mettre à jour une commande par ID
router.patch('/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!order) {
            return res.status(404).send();
        }
        res.status(200).send(order);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Supprimer une commande par ID
router.delete('/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).send();
        }
        res.status(200).send(order);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;
