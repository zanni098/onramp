import React from 'react';

const Products = () => {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl">Products</h1>
        <button className="glow-button">New Product</button>
      </div>
      <div className="glow-card p-10 text-center text-zinc-500">
        No products created yet. Start by creating your first payment link.
      </div>
    </div>
  );
};
export default Products;
