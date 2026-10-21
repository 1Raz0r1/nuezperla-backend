import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 1. Obtener TODOS los productos (sin paginación, sin caché)
app.get('/api/products', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products ORDER BY id ASC');
        res.json({ products: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// 2. Actualizar el stock
app.patch('/api/products/:id/stock', async (req, res) => {
    const { id } = req.params;
    const { stock } = req.body;
    try {
        await pool.query('UPDATE products SET stock = $1 WHERE id = $2', [stock, id]);
        res.json({ message: 'Stock actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar stock' });
    }
});

// 3. Actualizar un producto completo
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, category, stock, image } = req.body;
    try {
        await pool.query(
            'UPDATE products SET name = $1, description = $2, price = $3, category = $4, stock = $5, image = $6 WHERE id = $7',
            [name, description, price, category, stock, image, id]
        );
        res.json({ message: 'Producto actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

// Ruta de Delivery-orders
app.post('/api/orders', async (req, res) => {
    const { usuario_id, total, direccion, telefono_contacto, notas, items } = req.body;
    
    try {
        // 1. Guardar el pedido principal
        const pedidoResult = await pool.query(
            'INSERT INTO pedidos (usuario_id, total, direccion, telefono_contacto, notas) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [usuario_id, total, direccion, telefono_contacto, notas]
        );
        const pedidoId = pedidoResult.rows[0].id;

        // 2. Guardar los productos del pedido
        for (const item of items) {
            await pool.query(
                'INSERT INTO pedido_items (pedido_id, producto_id, cantidad, medida, precio_unitario) VALUES ($1, $2, $3, $4, $5)',
                [pedidoId, item.producto_id, item.cantidad, item.medida, item.precio_unitario]
            );
        }

        res.status(201).json({ message: 'Pedido creado', pedidoId: pedidoId.toStrig });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el pedido' });
    }
});

// RUTA DE REGISTRO
app.post('/api/auth/register', async (req, res) => {
    const { nombre, telefono, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO usuarios (nombre, telefono, password, is_admin) VALUES ($1, $2, $3, false)',
            [nombre, telefono, hashedPassword]
        );
        res.status(201).json({ message: 'Usuario creado' });
    } catch (error) {
        res.status(500).json({ error: 'El teléfono ya está registrado' });
    }
});

// RUTA DE LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { telefono, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM usuarios WHERE telefono = $1', [telefono]);
        if (rows.length === 0) return res.status(401).json({ error: 'Teléfono no registrado' });

        const usuario = rows[0];
        const passwordValido = await bcrypt.compare(password, usuario.password);
        if (!passwordValido) return res.status(401).json({ error: 'Contraseña incorrecta' });

        const token = jwt.sign(
            { id: usuario.id, telefono: usuario.telefono, isAdmin: usuario.is_admin }, 
            'SECRETO_SUPER_SEGURO', 
            { expiresIn: '24h' }
        );
        
        res.json({ 
            message: 'Login exitoso', 
            token, 
            nombre: usuario.nombre,
            isAdmin: usuario.is_admin 
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// OBTENER TODOS LOS PEDIDOS (Para el Admin)
app.get('/api/orders', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT p.id, p.total, p.direccion, p.telefono_contacto, p.notas, p.estado, p.fecha_creacion, u.nombre as cliente
            FROM pedidos p
            JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.fecha_creacion DESC
        `);
        
        const pedidosCompletos = [];
        for (const pedido of rows) {
            const items = await pool.query(
                'SELECT producto_id, cantidad, medida, precio_unitario FROM pedido_items WHERE pedido_id = $1',
                [pedido.id]
            );
            pedidosCompletos.push({ ...pedido, items: items.rows });
        }

        res.json({ orders: pedidosCompletos });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

// RUTA PARA ACTUALIZAR EL ESTADO DE UN PEDIDO
app.patch('/api/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    try {
        await pool.query('UPDATE pedidos SET estado = $1 WHERE id = $2', [estado, id]);
        res.json({ message: 'Estado actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// RUTA PARA GENERAR EL LINK DE PAGO DE MERCADO PAGO
app.post('/api/payments/create', async (req, res) => {
    const { pedidoId, total, titulo } = req.body;

    try {
        const client = new MercadoPagoConfig({ accessToken: 'APP_USR-3727210879871432-102103-1dece27c8700080d5ab10437a648b36a-3782298926' });

        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                external_reference: pedidoId.toString(), // <-- AGREGADO PARA EL WEBHOOK
                items: [
                    {
                        id: pedidoId.toString(),
                        title: titulo || `Pedido NuezPerla #${pedidoId}`,
                        quantity: 1,
                        unit_price: Number(Number(total).toFixed(2)),
                    }
                ],
                back_urls: {
                    success: 'https://nuezperla-backend.onrender.com',
                    failure: 'https://nuezperla-backend.onrender.com',
                    pending: 'https://nuezperla-backend.onrender.com',
                },
                auto_return: 'approved',
                notification_url: 'https://nuezperla-backend.onrender.com/api/payments/webhook' // <-- AGREGADO
            }
        });

        res.json({ init_point: result.init_point });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el pago' });
    }
});

// RUTA PARA RECIBIR NOTIFICACIONES DE MERCADO PAGO (WEBHOOK)
app.post('/api/payments/webhook', async (req, res) => {
    console.log("🔔 Webhook recibido:", JSON.stringify(req.body));

    const type = req.body.type || req.query.type;
    const dataId = req.body.data?.id || req.query['data.id'];

    if (type === 'payment' && dataId) {
        try {
            // ⚠️ LEEMOS EL TOKEN DESDE LA VARIABLE DE ENTORNO
            const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' });
            const payment = new Payment(client);
            
            const paymentInfo = await payment.get({ id: dataId });
            console.log("💰 Estado del pago:", paymentInfo.status);

            if (paymentInfo.status === 'approved') {
                const pedidoId = paymentInfo.external_reference;
                console.log("✅ Pago aprobado para el pedido:", pedidoId);

                const items = await pool.query(
                    'SELECT producto_id, cantidad, medida FROM pedido_items WHERE pedido_id = $1',
                    [pedidoId]
                );

                for (const item of items.rows) {
                    let factor = 1.0;
                    if (item.medida === 'MEDIO') factor = 0.5;
                    if (item.medida === 'CUARTO') factor = 0.25;
                    if (item.medida === 'OCTAVO') factor = 0.125;

                    const cantidadADescontar = factor * item.cantidad;

                    await pool.query(
                        'UPDATE products SET stock = stock - $1 WHERE id = $2',
                        [cantidadADescontar, item.producto_id]
                    );
                }

                await pool.query(
                    'UPDATE pedidos SET estado = $1 WHERE id = $2',
                    ['Pagado', pedidoId]
                );
                console.log("📦 Stock actualizado y pedido marcado como Pagado");
            }

            res.status(200).send('OK');
        } catch (error) {
            console.error('❌ Error en Webhook:', error);
            res.status(500).send('Error');
        }
    } else {
        res.status(200).send('OK');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🔥 Backend NuezPerla corriendo en http://localhost:${PORT}`);
});
