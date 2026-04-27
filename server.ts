import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import knex from 'knex';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  let db: any;
  try {
    console.log('Initializing database connection...');
    db = knex({
      client: 'better-sqlite3',
      connection: {
        filename: path.join(process.cwd(), 'data.sqlite')
      },
      useNullAsDefault: true,
      pool: {
        min: 1,
        max: 1,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000
      }
    });

    // Test connection
    await db.raw('SELECT 1');
    console.log('Database connection successful.');

    console.log('Checking tables...');
    const tables = [
      {
        name: 'inventory',
        create: (table: any) => {
          table.increments('id');
          table.string('name').notNullable();
          table.integer('quantity').defaultTo(0);
          table.decimal('price', 10, 2).defaultTo(0);
          table.timestamps(true, true);
        }
      },
      {
        name: 'customers',
        create: (table: any) => {
          table.increments('id');
          table.string('name').notNullable();
          table.string('tax_id');
          table.string('address');
          table.string('phone');
          table.timestamps(true, true);
        }
      },
      {
        name: 'rentals',
        create: (table: any) => {
          table.increments('id');
          table.integer('customer_id').unsigned().references('customers.id');
          table.date('delivery_date');
          table.date('return_date');
          table.string('status').defaultTo('ACTIVE');
          table.timestamps(true, true);
        }
      },
      {
        name: 'rental_items',
        create: (table: any) => {
          table.increments('id');
          table.integer('rental_id').unsigned().references('rentals.id').onDelete('CASCADE');
          table.integer('inventory_id').unsigned().references('inventory.id');
          table.integer('quantity').notNullable();
        }
      }
    ];

    for (const { name, create } of tables) {
      if (!(await db.schema.hasTable(name))) {
        console.log(`Creating table ${name}...`);
        await db.schema.createTable(name, create);
      } else if (name === 'inventory') {
        const hasPrice = await db.schema.hasColumn('inventory', 'price');
        if (!hasPrice) {
          console.log('Adding price column to inventory...');
          await db.schema.table('inventory', table => {
            table.decimal('price', 10, 2).defaultTo(0);
          });
        }
      }
    }
    console.log('Schema verification complete.');
  } catch (error) {
    console.error('DATABASE CRITICAL ERROR:', error);
    // Don't exit(1), let the server start so we can see the error in the health API
  }

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: db ? 'ok' : 'db_error', 
      database_ready: !!db,
      time: new Date().toISOString(),
      node_env: process.env.NODE_ENV
    });
  });

  // Inventory
  app.get('/api/inventory', async (req, res) => {
    const items = await db('inventory').select('*');
    const enrichedItems = [];
    for (const item of items) {
      const rented = await db('rental_items')
        .join('rentals', 'rental_items.rental_id', '=', 'rentals.id')
        .where('rental_items.inventory_id', item.id)
        .where('rentals.status', 'ACTIVE')
        .sum('rental_items.quantity as total')
        .first();
      enrichedItems.push({
        ...item,
        available: item.quantity - (rented?.total || 0),
        rented: rented?.total || 0
      });
    }
    res.json(enrichedItems);
  });

  app.post('/api/inventory', async (req, res) => {
    const [id] = await db('inventory').insert(req.body);
    const item = await db('inventory').where({ id }).first();
    io.emit('inventory_updated');
    res.json(item);
  });

  app.put('/api/inventory/:id', async (req, res) => {
    await db('inventory').where({ id: req.params.id }).update(req.body);
    io.emit('inventory_updated');
    res.json({ success: true });
  });

  app.delete('/api/inventory/:id', async (req, res) => {
    await db('inventory').where({ id: req.params.id }).delete();
    io.emit('inventory_updated');
    res.json({ success: true });
  });

  // Customers
  app.get('/api/customers', async (req, res) => {
    const customers = await db('customers').select('*');
    res.json(customers);
  });

  app.post('/api/customers', async (req, res) => {
    const [id] = await db('customers').insert(req.body);
    const customer = await db('customers').where({ id }).first();
    io.emit('customers_updated');
    res.json(customer);
  });

  app.put('/api/customers/:id', async (req, res) => {
    await db('customers').where({ id: req.params.id }).update(req.body);
    io.emit('customers_updated');
    res.json({ success: true });
  });

  // Rentals
  app.get('/api/rentals', async (req, res) => {
    const rentals = await db('rentals')
      .join('customers', 'rentals.customer_id', '=', 'customers.id')
      .select(
        'rentals.*', 
        'customers.name as customer_name', 
        'customers.phone as customer_phone',
        'customers.address as customer_address',
        'customers.tax_id as customer_tax_id'
      );
    
    for (const rental of rentals) {
      rental.items = await db('rental_items')
        .join('inventory', 'rental_items.inventory_id', '=', 'inventory.id')
        .where('rental_id', rental.id)
        .select('rental_items.*', 'inventory.name as item_name', 'inventory.price as item_price');
    }
    res.json(rentals);
  });

  app.post('/api/rentals', async (req, res) => {
    const { customer_id, delivery_date, return_date, items } = req.body;
    
    const [rental_id] = await db('rentals').insert({
      customer_id,
      delivery_date,
      return_date,
      status: 'ACTIVE'
    });

    for (const item of items) {
      await db('rental_items').insert({
        rental_id,
        inventory_id: item.inventory_id,
        quantity: item.quantity
      });
    }

    io.emit('rentals_updated');
    io.emit('inventory_updated');
    res.json({ id: rental_id });
  });

  app.post('/api/rentals/:id/return', async (req, res) => {
    await db('rentals').where({ id: req.params.id }).update({ status: 'RETURNED' });
    io.emit('rentals_updated');
    io.emit('inventory_updated');
    res.json({ success: true });
  });

  // Dashboard Stats
  app.get('/api/stats', async (req, res) => {
    const totalInventory = await db('inventory').sum('quantity as total').first();
    
    const activeRentals = await db('rentals').where('status', 'ACTIVE');
    let rentedQuantity = 0;
    let lateRentalsCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const rental of activeRentals) {
      const items = await db('rental_items').where('rental_id', rental.id).sum('quantity as total').first();
      rentedQuantity += items?.total || 0;
      if (rental.return_date < today) {
        lateRentalsCount++;
      }
    }

    const totalCustomers = await db('customers').count('id as total').first();

    res.json({
      totalInventory: totalInventory?.total || 0,
      availableInventory: (totalInventory?.total || 0) - rentedQuantity,
      activeRentals: activeRentals.length,
      lateRentals: lateRentalsCount,
      totalCustomers: totalCustomers?.total || 0
    });
  });

  // Socket connection
  io.on('connection', (socket) => {
    console.log('Client connected');
  });

  // Vite Integration
  console.log('Initializing Vite middleware...');
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware initialized.');
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  console.log(`Attempting to listen on port ${PORT}...`);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
