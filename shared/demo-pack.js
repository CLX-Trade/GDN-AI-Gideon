// A fictional document pack that drives the homepage demo. The real rule engine
// runs over it in the visitor's browser, so every number on screen is genuinely
// computed. Names and figures are invented, and the page says so.
export const DEMO_PACK = [
  {
    name: 'Commercial Invoice',
    short: 'INV',
    doc_type: 'commercial_invoice',
    fields: [
      { key: 'seller', value: 'Meridian Commodities Pte Ltd', page: 1 },
      { key: 'buyer', value: 'Harbourline Imports Pty Ltd', page: 1 },
      { key: 'invoice_number', value: 'MC-2026-1001', page: 1 },
      { key: 'invoice_date', value: '12 September 2026', page: 1 },
      { key: 'contract_number', value: 'SPA-4471', page: 1 },
      { key: 'commodity', value: 'Refined white sugar ICUMSA 45', page: 1 },
      { key: 'hs_code', value: '1701.99', page: 1 },
      { key: 'net_quantity', value: '500.000 MT', page: 1 },
      { key: 'unit_price', value: 'USD 612.00/MT', page: 1 },
      { key: 'total_amount', value: 'USD 306,000.00', page: 1 },
      { key: 'incoterm', value: 'CIF Brisbane', page: 1 },
      { key: 'port_of_loading', value: 'Santos', page: 1 },
      { key: 'port_of_discharge', value: 'Brisbane', page: 1 },
      { key: 'shipment_date', value: '11 September 2026', page: 1 },
      { key: 'account_name', value: 'Meridian Commodities Pte Ltd', page: 2 },
      { key: 'swift_bic', value: 'OCBCSGSG', page: 2 },
    ],
  },
  {
    name: 'Packing List',
    short: 'PKL',
    doc_type: 'packing_list',
    fields: [
      { key: 'seller', value: 'Meridian Commodities Pte Ltd', page: 1 },
      { key: 'buyer', value: 'Harbourline Imports Pty Ltd', page: 1 },
      { key: 'invoice_number', value: 'MC-2026-1001', page: 1 },
      { key: 'net_quantity', value: '480.000 MT', page: 1 },
      { key: 'packages', value: '20 containers', page: 1 },
      { key: 'container_number', value: 'CSQU3054383, MSKU1234565', page: 1 },
    ],
  },
  {
    name: 'Bill of Lading',
    short: 'B/L',
    doc_type: 'bill_of_lading',
    fields: [
      { key: 'shipper', value: 'Meridian Commodity Trading Pte Ltd', page: 1 },
      { key: 'consignee', value: 'To order of Harbourline Imports Pty Ltd', page: 1 },
      { key: 'bl_number', value: 'SNTBNE260911', page: 1 },
      { key: 'vessel_name', value: 'MV Southern Cross', page: 1 },
      { key: 'imo_number', value: 'IMO 9074728', page: 1 },
      { key: 'net_quantity', value: '500.000 MT', page: 1 },
      { key: 'port_of_loading', value: 'Santos', page: 1 },
      { key: 'port_of_discharge', value: 'Brisbane', page: 1 },
      { key: 'on_board_date', value: '9 September 2026', page: 1 },
      { key: 'bl_issue_date', value: '9 September 2026', page: 1 },
      { key: 'container_number', value: 'CSQU3054383, MSKU1234565', page: 1 },
    ],
  },
  {
    name: 'Letter of Credit',
    short: 'L/C',
    doc_type: 'letter_of_credit',
    fields: [
      { key: 'applicant', value: 'Harbourline Imports Pty Ltd', page: 1 },
      { key: 'beneficiary', value: 'Meridian Commodities Pte Ltd', page: 1 },
      { key: 'lc_number', value: 'LC88213', page: 1 },
      { key: 'contract_number', value: 'SPA-4471', page: 1 },
      { key: 'total_amount', value: 'USD 306,000.00', page: 1 },
      { key: 'incoterm', value: 'CIF Brisbane', page: 1 },
      { key: 'latest_shipment_date', value: '5 September 2026', page: 1 },
      { key: 'lc_expiry_date', value: '30 September 2026', page: 1 },
    ],
  },
];

// Fixed clock so the demo gives the same result on any day.
export const DEMO_NOW = Date.UTC(2026, 9, 1);
