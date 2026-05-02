
import knex from 'knex';
import path from 'path';

async function test() {
  const db = knex({
    client: 'better-sqlite3',
    connection: {
      filename: path.join(process.cwd(), 'data.sqlite')
    },
    useNullAsDefault: true
  });

  try {
    console.log('Testing insertion...');
    const [customerId] = await db('customers').insert({ name: 'Test Customer', phone: '123' });
    console.log('Inserted customer ID:', customerId);
    
    const [inventoryId] = await db('inventory').insert({ name: 'Test Item', quantity: 10, price: 5.5 });
    console.log('Inserted inventory ID:', inventoryId);
    
    const [rentalId] = await db('rentals').insert({
      customer_id: customerId,
      delivery_date: '2024-05-01',
      return_date: '2024-05-10',
      status: 'ACTIVE'
    });
    console.log('Inserted rental ID:', rentalId);
    
    await db('rental_items').insert({
      rental_id: rentalId,
      inventory_id: inventoryId,
      quantity: 5
    });
    console.log('Inserted rental item.');
    
    console.log('Cleanup...');
    await db('rental_items').where({ rental_id: rentalId }).delete();
    await db('rentals').where({ id: rentalId }).delete();
    await db('customers').where({ id: customerId }).delete();
    await db('inventory').where({ id: inventoryId }).delete();
    
    console.log('Test PASSED');
  } catch (err) {
    console.error('Test FAILED:', err);
  } finally {
    await db.destroy();
  }
}

test();
