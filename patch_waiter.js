const fs = require('fs');
let code = fs.readFileSync('src/views/WaiterView.tsx', 'utf8');

// Add mixedPayments state
code = code.replace(
  "const [paymentCurrency, setPaymentCurrency] = useState('Bs');",
  "const [paymentCurrency, setPaymentCurrency] = useState('Bs');\n  const [mixedPayments, setMixedPayments] = useState<{ id: string, method: string, amountUSD: number, currency: string, reference: string, receiptImage: string | null }[]>([]);"
);

// Reset mixedPayments when opening payment modal
code = code.replace(
  "setNonCreditClientMode('none');",
  "setNonCreditClientMode('none');\n                  setMixedPayments([]);"
);

// Add 'mixto' to methods
code = code.replace(
  "{ id: 'punto', label: 'Punto (Bs)' },",
  "{ id: 'punto', label: 'Punto (Bs)' },\n                      { id: 'mixto', label: 'Mixto' },"
);

fs.writeFileSync('src/views/WaiterView.tsx', code);
