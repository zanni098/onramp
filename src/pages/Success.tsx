import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

const Success = () => {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto border border-success">
          <Check className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-4xl text-white font-serif">Payment Successful</h2>
        <p className="text-zinc-400">
          Your transaction has been confirmed on the blockchain. The merchant will fulfill your order shortly.
        </p>
        <Link to="/" className="glow-button inline-block mt-8">
          Return Home
        </Link>
      </div>
    </div>
  );
};
export default Success;
