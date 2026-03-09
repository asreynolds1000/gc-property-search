export interface VehicleTaxResult {
  name: string
  vin: string
  accountNumber: string     // Full "YYYY MM RRRRRRR CC SSS"
  taxes: string             // e.g., "$80.16"
  district: string
  paid: string              // e.g., "$43.12 06/17/2025" or "$0"
  amountDue: string
  detailParams: {
    year: string
    month: string
    receipt: string
    code: string
    suffix: string
  }
}

export interface VehicleTaxDetail {
  name: string
  levyYear: string
  accountNumber: string
  vehicleYear?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleBody?: string
  vehicleWeight?: string
  vin?: string
  district?: string
  expirationDate?: string
  assessment?: string
  numberOfMonths?: string
  countyMillage?: string
  cityMillage?: string
  totalTaxes?: string
  roadFee?: string
  dmvDecalFee?: string
  processingFee?: string
  highMileCredit?: string
  totalBilled?: string
  totalPaid?: string
  balanceDue?: string
  datePaid?: string
  status?: string
}

export interface OtherTaxResult {
  name: string
  receiptNumber: string     // "YYYY RRRRRRR II SSS"
  location?: string
  scheduleId?: string
  mapNumber?: string
  permitNumber?: string
  district?: string
  exempt?: string
  delinquent?: string
  assessment?: string
  datePaid?: string
  baseAmount?: string
  amountPaid?: string
  balanceDue?: string
  detailParams: {
    year: string
    receipt: string
    item: string
    suffix: string
  }
}

export interface OtherTaxDetail {
  name: string
  levyYear: string
  receiptNumber: string
  address?: string
  cityStateZip?: string
  district?: string
  exempt?: string
  delinquent?: string
  assessment?: string
  appraisal?: string
  countyMill?: string
  cityMill?: string
  itemCode: string
  propertyType: string
  // Type-specific detail (boats, aircraft, boat motors -- items 10, 11, 14, 30, 32)
  yearMakeModel?: {
    year?: string
    make?: string
    model?: string
    title?: string
    serialNumber?: string
    length?: string
  }
  // Tax summary
  taxWithoutPenalty?: string
  taxPlusThreePercent?: string
  taxPlusTenPercent?: string
  taxWithCostPlusFifteenPercent?: string
  totalTaxes?: string
  miscCosts?: string
  totalBilled?: string
  totalPaid?: string
  balanceDue?: string
}
