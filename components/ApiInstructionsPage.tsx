import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ApiInstructionsPageProps {
  onBack: () => void;
}

// FIX: Make children optional to satisfy the type-checker which fails to recognize JSX children.
const CodeBlock = ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-black/50 border border-white/10 rounded-md p-4 text-sm text-gray-300 overflow-x-auto">
        <code>{children}</code>
    </pre>
);

const FieldRow = ({ field, type, required, description }: { field: string, type: string, required: boolean, description: string }) => (
    <tr className="border-b border-white/10">
        <td className="py-2 px-4 font-mono text-white">{field}</td>
        <td className="py-2 px-4 font-mono text-gray-400">{type}</td>
        <td className="py-2 px-4">{required ? <span className="text-red-400 font-bold">Yes</span> : 'No'}</td>
        <td className="py-2 px-4 text-gray-300">{description}</td>
    </tr>
);


function ApiInstructionsPage({ onBack }: ApiInstructionsPageProps) {
    const { envConfig } = useAuth();
    const apiEndpoint = envConfig.VITE_API_ENDPOINT_URL || 'http://localhost:5883/api/v1';
    const apiSecret = envConfig.VITE_API_SECRET_TOKEN || '[Set in Profile]';

    const examplePayload = `{
  "symbol": "BTC/USDT",
  "side": "LONG",
  "entry_price": 65000,
  "tp_price": 68000,
  "sl_price": 63500,
  "quantity": 0.1,
  "post_url": "https://x.com/your_user/status/123456",
  "opened_at": 1672531200000
}`;

    const curlExample = `curl -X POST "${apiEndpoint}/trades" \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer ${apiSecret}" \\
-d '${examplePayload}'`;


  return (
    <div className="max-w-4xl mx-auto bg-black/30 backdrop-blur-sm border border-white/10 p-8 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">
          API Integration Guide
        </h2>
        <button
          onClick={onBack}
          className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      <div className="space-y-8 text-gray-300">
        <p>
            Use this guide to send new trade data to the AIR3 Track application. The system will listen for incoming requests and populate the trades database accordingly.
        </p>

        {/* Endpoint */}
        <section>
            <h3 className="text-xl font-semibold text-white mb-2">Endpoint</h3>
            <p>All new trades should be sent via a <code className="bg-white/10 px-1 rounded">POST</code> request to the following endpoint:</p>
            <CodeBlock>{apiEndpoint}/trades</CodeBlock>
        </section>

        {/* Authentication */}
        <section>
            <h3 className="text-xl font-semibold text-white mb-2">Authentication</h3>
            <p>Requests must be authenticated using a Bearer Token in the <code className="bg-white/10 px-1 rounded">Authorization</code> header. The token is your configured <code className="bg-white/10 px-1 rounded">API_SECRET_TOKEN</code>.</p>
            <CodeBlock>Authorization: Bearer {apiSecret}</CodeBlock>
        </section>

        {/* Request Body */}
        <section>
            <h3 className="text-xl font-semibold text-white mb-2">Request Body (JSON)</h3>
            <p>The body of the request must be a JSON object with the following fields:</p>
            <div className="overflow-x-auto mt-4 border border-white/10 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-black/50 text-xs text-gray-400 uppercase">
                        <tr>
                            <th className="py-3 px-4">Field</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Required</th>
                            <th className="py-3 px-4">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <FieldRow field="symbol" type="string" required={true} description="The trading pair (e.g., 'BTC/USDT')." />
                        <FieldRow field="side" type="string" required={true} description="Trade direction. Must be 'LONG' or 'SHORT'." />
                        <FieldRow field="entry_price" type="number" required={true} description="The entry price for the position." />
                        <FieldRow field="tp_price" type="number" required={true} description="The take-profit price level." />
                        <FieldRow field="sl_price" type="number" required={true} description="The stop-loss price level." />
                        <FieldRow field="quantity" type="number" required={false} description="The size of the position." />
                        <FieldRow field="post_url" type="string" required={true} description="URL to a social media post (e.g., a Tweet)." />
                        <FieldRow field="opened_at" type="number" required={true} description="Timestamp in milliseconds when the trade was opened." />
                    </tbody>
                </table>
            </div>
        </section>

        {/* Example */}
        <section>
            <h3 className="text-xl font-semibold text-white mb-2">Example Request</h3>
            <p className="mb-2">Here is an example payload:</p>
            <CodeBlock>{examplePayload}</CodeBlock>
            <p className="mt-4 mb-2">And a full example using <code className="bg-white/10 px-1 rounded">curl</code>:</p>
            <CodeBlock>{curlExample}</CodeBlock>
        </section>

      </div>
    </div>
  );
}

export default ApiInstructionsPage;