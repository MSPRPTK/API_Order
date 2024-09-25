const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const amqp = require('amqplib');
const promClient = require('prom-client');

// Configuration des métriques Prometheus
const register = new promClient.Registry();

// Compteur pour le nombre total de commandes créées
const orderCounter = new promClient.Counter({
    name: 'order_total_count',
    help: 'Total number of orders created',
});

// Compteur pour le nombre de commandes annulées
const canceledOrderCounter = new promClient.Counter({
    name: 'order_canceled_count',
    help: 'Total number of orders canceled',
});

// Compteur pour le nombre total de produits commandés
const productCounter = new promClient.Counter({
    name: 'total_products_ordered',
    help: 'Total number of products ordered',
});

// Compteur pour le nombre de requêtes GET pour les commandes
const getOrderCounter = new promClient.Counter({
    name: 'order_get_requests_count',
    help: 'Total number of GET requests for orders',
});

// Compteur pour les erreurs 404
const notFoundCounter = new promClient.Counter({
    name: 'http_404_errors_count',
    help: 'Total number of 404 errors',
});

// Histogramme pour la durée des requêtes HTTP
const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
});

// Enregistrer les métriques
register.registerMetric(orderCounter);
register.registerMetric(canceledOrderCounter);
register.registerMetric(productCounter);
register.registerMetric(getOrderCounter);
register.registerMetric(notFoundCounter);
register.registerMetric(httpRequestDurationMicroseconds);

// Connexion à RabbitMQ
const connect = async () => {
    try {
        const connection = await amqp.connect('amqp://rabbitmq');
        const channel = await connection.createChannel();
        return channel;
    } catch (error) {
        console.error('Error connecting to RabbitMQ', error);
    }
};

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
};

// Middleware pour mesurer la durée des requêtes
router.use((req, res, next) => {
    const end = httpRequestDurationMicroseconds.startTimer();

    res.on('finish', () => {
        end({ method: req.method, route: req.route?.path, status_code: res.statusCode });
    });

    next();
});

// Créer une nouvelle commande
router.post('/', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.status(201).send(order);

        // Incrémenter le compteur de commandes et le compteur de produits
        orderCounter.inc();
        for (const product of order.products) {
            productCounter.inc(product.quantity); // Incrementez le compteur pour chaque produit
            await publishMessage(product._id, product.quantity);
        }
    } catch (error) {
        res.status(400).send(error);
    }
});

// Lire toutes les commandes
router.get('/', async (req, res) => {
    try {
        getOrderCounter.inc(); // Incrementez le compteur de requêtes GET
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
            notFoundCounter.inc(); // Incrementez le compteur d'erreurs 404 si la commande n'est pas trouvée
            return res.status(404).send();
        }
        res.status(200).send(order);
    } catch (error) {
        notFoundCounter.inc(); // En cas d'erreur, incrémentez également le compteur 404
        res.status(500).send(error);
    }
});

// Mettre à jour une commande par ID
router.patch('/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!order) {
            notFoundCounter.inc(); // Incrementez le compteur d'erreurs 404 si la commande n'est pas trouvée
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
            notFoundCounter.inc(); // Incrementez le compteur d'erreurs 404 si la commande n'est pas trouvée
            return res.status(404).send();
        }
        res.status(200).send(order);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Endpoint pour les métriques Prometheus
router.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).send('Error getting metrics');
    }
});

module.exports = router;
