import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // OCR Scan Receipt Endpoint
  app.post('/api/ocr/scan-receipt', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', context } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'No image data provided' });
      }

      const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');

      const categoriesList =
        context?.categories?.join(', ') ||
        'Food & Dining, Groceries, Shopping, Transport, Entertainment, Utilities, Health, Personal, General';
      const walletsList = context?.wallets?.join(', ') || 'Cash, Bank, GPay, Credit Card';
      const friendsList = context?.friends?.join(', ') || '';

      const prompt = `Analyze this receipt, bill, invoice, or transaction screenshot carefully and extract all relevant expense information.
Context details:
- Available expense categories: ${categoriesList}
- Available wallets/payment accounts: ${walletsList}
- Known friends/contacts: ${friendsList}
- Preferred currency: ${context?.currency || 'INR'}
- Today's date: ${new Date().toISOString().slice(0, 10)}

Rules:
1. Extract the merchant, store, restaurant, vendor, or utility name.
2. Extract the total final payable amount (as a clean positive number).
3. Extract the transaction date in YYYY-MM-DD format. If only day/month is visible, assume current year. If no date is found, use today's date.
4. Categorize accurately using the closest matching category from the available list.
5. Identify the payment method (Cash, Card, UPI, etc.) and match to the closest available wallet.
6. Extract individual line items (name, quantity, price) if present on the receipt.
7. Extract tax amount (GST, VAT, Sales Tax), tips, and discounts if present.
8. Create a clean short description title for the ledger (1-4 words, e.g. "Dinner at Subway", "Grocery at Target", "Starbucks Coffee").
9. If invoice/bill number is visible, extract it.
10. Summarize key receipt details in notes.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchantName: { type: Type.STRING, description: 'Store, vendor, restaurant or biller name' },
              description: { type: Type.STRING, description: 'Brief description for the transaction title (1-4 words)' },
              totalAmount: { type: Type.NUMBER, description: 'Total final amount' },
              currency: { type: Type.STRING, description: 'Currency code or symbol detected' },
              date: { type: Type.STRING, description: 'Transaction date in YYYY-MM-DD format' },
              category: { type: Type.STRING, description: 'Best matching category from context list' },
              suggestedWallet: { type: Type.STRING, description: 'Suggested wallet/payment account name' },
              taxAmount: { type: Type.NUMBER, description: 'Total tax amount (GST/VAT/Sales tax) if any, else 0' },
              discountAmount: { type: Type.NUMBER, description: 'Discount or savings amount if any, else 0' },
              tipAmount: { type: Type.NUMBER, description: 'Tip or gratuity amount if any, else 0' },
              invoiceNumber: { type: Type.STRING, description: 'Invoice, bill, or receipt number if visible' },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: 'Item name or service' },
                    quantity: { type: Type.NUMBER, description: 'Quantity (default 1)' },
                    price: { type: Type.NUMBER, description: 'Total price for this line item' },
                  },
                  required: ['name', 'price'],
                },
                description: 'Itemized line items from the bill',
              },
              notes: { type: Type.STRING, description: 'Additional details, payment mode, or breakdown notes' },
              confidence: { type: Type.STRING, description: 'high, medium, or low confidence' },
            },
            required: ['merchantName', 'description', 'totalAmount', 'date', 'category'],
          },
        },
      });

      const responseText = response.text || '{}';
      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (error: unknown) {
      console.error('Error scanning receipt:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process receipt image with Gemini OCR';
      return res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Mount Vite middleware in development or serve static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Okane Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
