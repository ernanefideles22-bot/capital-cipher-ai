import type { Trade } from '@/types/trading';

export const exportToCSV = (trades: Trade[], filename: string = 'trades') => {
  const headers = [
    'ID',
    'Símbolo',
    'Lado',
    'Estratégia',
    'Preço de Entrada',
    'Preço de Saída',
    'Quantidade',
    'Alavancagem',
    'Stop Loss',
    'Take Profit',
    'P&L ($)',
    'P&L (%)',
    'Status',
    'Data de Abertura',
    'Data de Fechamento'
  ];

  const rows = trades.map(trade => [
    trade.id,
    trade.symbol,
    trade.side,
    trade.strategy || '',
    trade.entryPrice?.toFixed(8) || '',
    trade.exitPrice?.toFixed(8) || '',
    trade.quantity?.toFixed(8) || '',
    trade.leverage?.toString() || '',
    trade.stopLoss?.toFixed(8) || '',
    trade.takeProfit?.toFixed(8) || '',
    trade.pnl?.toFixed(2) || '',
    trade.pnlPercentage?.toFixed(2) || '',
    trade.status,
    trade.openedAt?.toISOString() || '',
    trade.closedAt?.toISOString() || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToExcel = (trades: Trade[], filename: string = 'trades') => {
  // Create a more Excel-friendly format with proper headers and formatting
  const headers = [
    'ID',
    'Símbolo',
    'Lado',
    'Estratégia',
    'Preço de Entrada',
    'Preço de Saída',
    'Quantidade',
    'Alavancagem',
    'Stop Loss',
    'Take Profit',
    'P&L ($)',
    'P&L (%)',
    'Status',
    'Data de Abertura',
    'Data de Fechamento'
  ];

  const rows = trades.map(trade => [
    trade.id,
    trade.symbol,
    trade.side,
    trade.strategy || '',
    trade.entryPrice || '',
    trade.exitPrice || '',
    trade.quantity || '',
    trade.leverage || '',
    trade.stopLoss || '',
    trade.takeProfit || '',
    trade.pnl || '',
    trade.pnlPercentage || '',
    trade.status,
    trade.openedAt ? new Date(trade.openedAt).toLocaleString('pt-BR') : '',
    trade.closedAt ? new Date(trade.closedAt).toLocaleString('pt-BR') : ''
  ]);

  // Create XML-based Excel format (works without external libraries)
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Trades">
    <Table>
      <Row>
        ${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
      </Row>
      ${rows.map(row => `
      <Row>
        ${row.map((cell, index) => {
          const type = typeof cell === 'number' ? 'Number' : 'String';
          return `<Cell><Data ss:Type="${type}">${cell}</Data></Cell>`;
        }).join('')}
      </Row>
      `).join('')}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportSummaryToCSV = (stats: {
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
}, filename: string = 'performance_summary') => {
  const rows = [
    ['Métrica', 'Valor'],
    ['P&L Total', `$${stats.totalPnL.toFixed(2)}`],
    ['Win Rate', `${stats.winRate.toFixed(1)}%`],
    ['Total de Trades', stats.totalTrades.toString()],
    ['Profit Factor', stats.profitFactor.toFixed(2)],
    ['Média de Ganho', `$${stats.avgWin.toFixed(2)}`],
    ['Média de Perda', `$${stats.avgLoss.toFixed(2)}`],
    ['Melhor Trade', `$${stats.bestTrade.toFixed(2)}`],
    ['Pior Trade', `$${stats.worstTrade.toFixed(2)}`],
    ['Data de Exportação', new Date().toLocaleString('pt-BR')]
  ];

  const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
