const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://nuezperla_db_user:lxIhhjGfgIpMKnOOc29oOi668WkGT0WY@dpg-dba7jc0m7kps73fpr5u0-a.ohio-postgres.render.com/nuezperla_db',
    ssl: { rejectUnauthorized: false }
});

const productos = [
    ["Nuez","Nuez entera",321,"Nueces",10],
    ["Nuez del Brasil","Nuez del Brasil",764,"Nueces",10],
    ["Nuez de la India","Nuez de la India",284,"Nueces",10],
    ["Macadamia cocoa","Macadamia con cocoa",544,"Nueces",10],
    ["Nuez choc.","Nuez con chocolate",464,"Nueces",10],
    ["Nuezuki","Nuezuki",284,"Nueces",10],
    ["Almendra","Almendra natural",284,"Frutos secos",10],
    ["Almendra té","Almendra con té",464,"Frutos secos",10],
    ["Almendra choc.","Almendra con chocolate",464,"Frutos secos",10],
    ["Almendra fileteada","Almendra fileteada",304,"Frutos secos",10],
    ["Almendra ahumada","Almendra ahumada",312,"Frutos secos",10],
    ["Pistache","Pistache natural",324,"Frutos secos",10],
    ["Pistache Ench.","Pistache enchilado",344,"Frutos secos",10],
    ["Semillas girasol","Semillas de girasol",240,"Semillas",10],
    ["Ajonjolí endulzado","Ajonjolí endulzado",124,"Semillas",10],
    ["Ajonjolí enchilado","Ajonjolí enchilado",124,"Semillas",10],
    ["Pepita con sal","Pepita con sal",184,"Semillas",10],
    ["Pepita sin sal","Pepita sin sal",188,"Semillas",10],
    ["Jamaica","Jamaica natural",144,"Semillas",10],
    ["Jamaica Ench.","Jamaica enchilada",164,"Semillas",10],
    ["Habas Enchiladas","Habas enchiladas",164,"Semillas",10],
    ["Cereza desh.","Cerezas deshidratadas",340,"Frutas secas",10],
    ["Fresa desh.","Fresas deshidratadas",364,"Frutas secas",10],
    ["Pasa nacional","Pasa nacional",124,"Frutas secas",10],
    ["Mango de Regio","Mango deshidratado",320,"Frutas secas",10],
    ["Arándanos","Arándanos deshidratados",164,"Frutas secas",10],
    ["Arándanos Ench.","Arándanos enchilados",184,"Frutas secas",10],
    ["Dátil","Dátil",220,"Frutas secas",10],
    ["Ciruela pasa","Ciruela pasa",164,"Frutas secas",10],
    ["Pasa choc.","Pasa con chocolate",320,"Confitados",10],
    ["Arándano choc.","Arándano con chocolate",464,"Confitados",10],
    ["Cereza chocogomi","Cereza con chocogomi",220,"Confitados",10],
    ["Cereza choc.","Cereza con chocolate",552,"Confitados",10],
    ["Platanitos","Platanitos",64,"Botanas",10],
    ["Manguitos","Manguitos Tailandia",264,"Botanas",10],
    ["Tubérculos","Tubérculos con chile",304,"Botanas",10],
    ["Mixto Botanero","Mixto botanero",128,"Botanas",10],
    ["Tablitas","Tablitas",264,"Botanas",10],
    ["Mixto xiocolatl","Mixto de xiocolatl",110,"Botanas",10],
    ["Chapulín grande","Chapulín grande",800,"Botanas",10],
    ["Chapulín chico","Chapulín chico",800,"Botanas",10],
    ["Granola","Granola",480,"Especiales",10],
    ["Proteína","Proteína",180,"Especiales",10]
];

async function cargar() {
    await client.connect();
    console.log("Conectado a la base de datos. Cargando productos...");
    
    for (const p of productos) {
        await client.query(
            'INSERT INTO products (name, description, price, category, stock) VALUES ($1, $2, $3, $4, $5)',
            p
        );
    }
    
    console.log("✅ ¡45 productos cargados exitosamente!");
    await client.end();
}

cargar();
