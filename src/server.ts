import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Requerido por Render
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🔥 Backend NuezPerla corriendo en http://localhost:${PORT}`);
});

