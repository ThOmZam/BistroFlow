const fs = require('fs');
let code = fs.readFileSync('src/views/DashboardView.tsx', 'utf8');

// Fix 1: The stray '$' before '{widgetId ==='
code = code.replace("                  ${widgetId === 'revenue' || widgetId === 'tables' || widgetId === 'validations' || widgetId === 'deliveries' || widgetId === 'salon_sales' || widgetId === 'delivery_sales' || widgetId === 'pickup_sales' || widgetId === 'service_time' ? (", 
"                  {widgetId === 'revenue' || widgetId === 'tables' || widgetId === 'validations' || widgetId === 'deliveries' || widgetId === 'salon_sales' || widgetId === 'delivery_sales' || widgetId === 'pickup_sales' || widgetId === 'service_time' ? (");

// Fix 2: The $$ in front of variables where it's causing double dollar signs. Let's just change them to single $.
code = code.replace(/\\$\\$\\{/g, '${');

// Check if we also have any stray $ inside JSX text.
// Example: <span className="...">$${dashboardMetrics.totalSales.toFixed(2)}</span>
code = code.replace(/\\$\\$\\{dashboardMetrics\\.totalSales/g, '${dashboardMetrics.totalSales');
code = code.replace(/\\$\\$\\{salesByChannel/g, '${salesByChannel');

fs.writeFileSync('src/views/DashboardView.tsx', code);
