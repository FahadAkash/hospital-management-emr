import { HttpClient } from "@angular/common/http";
import { Component } from "@angular/core";
import * as moment from "moment/moment";
import { MessageboxService } from "../../../shared/messagebox/messagebox.service";
import { AccountingSettingsBLService } from "../../settings/shared/accounting-settings.bl.service";
import { AccountingService } from "../../shared/accounting.service";
import { LedgerReportRequest_DTO } from "../shared/DTOs/ledger-report-request.dto";
import { SubLedgerReportRequest_DTO } from "../shared/DTOs/subledger-report-request.dot";
import { AccountingReportsBLService } from "../shared/accounting-reports.bl.service";

@Component({
  selector: "employee-financial-360",
  templateUrl: "./employee-financial-360.component.html"
})
export class EmployeeFinancial360Component {
  public fromDate: string = moment().startOf("month").format("YYYY-MM-DD");
  public toDate: string = moment().format("YYYY-MM-DD");
  public fiscalYearId: number = null;
  public validDate: boolean = true;

  public employees: any[] = [];
  public displayedEmployees: any[] = [];
  public selectedEmployee: any = null;
  public roleFilter: string = "all";

  public matchedLedgers: any[] = [];
  public matchedSubLedgers: any[] = [];
  public transactions: any[] = [];
  public monthlySummary: any[] = [];

  public summary = {
    TotalDebit: 0,
    TotalCredit: 0,
    NetBalance: 0,
    PaymentOut: 0,
    PaymentIn: 0,
    AdvanceGiven: 0,
    AdvanceRecovered: 0,
    SalaryTotal: 0,
    DeductionTotal: 0,
    NetSalaryTotal: 0
  };

  public subLedgerSummary = {
    OpeningDr: 0,
    OpeningCr: 0,
    ClosingDr: 0,
    ClosingCr: 0
  };

  public loading: boolean = false;
  public payrollMergeStatus: string = "";

  constructor(
    public accountingReportsBLService: AccountingReportsBLService,
    public accountingSettingsBLService: AccountingSettingsBLService,
    public accountingService: AccountingService,
    public http: HttpClient,
    public msgBoxServ: MessageboxService
  ) {
    this.loadEmployees();
  }

  public selectDate(event): void {
    if (event) {
      this.fromDate = event.fromDate;
      this.toDate = event.toDate;
      this.fiscalYearId = event.fiscalYearId;
      this.validDate = true;
    } else {
      this.validDate = false;
    }
  }

  public employeeListFormatter(data: any): string {
    const fullName = data && (data.FullName || data.EmployeeName || data.ShortName || "");
    const code = data && (data.EmployeeCode || data.Code || "");
    return `${fullName}${code ? " (" + code + ")" : ""}`;
  }

  public loadEmployeeFinancials(): void {
    if (!this.selectedEmployee || typeof this.selectedEmployee !== "object") {
      this.msgBoxServ.showMessage("warning", ["Select employee/doctor from the list."]);
      return;
    }
    if (!this.validDate) {
      this.msgBoxServ.showMessage("warning", ["Select valid date range."]);
      return;
    }

    this.resetData();
    this.loading = true;

    const employeeName = this.getEmployeeName(this.selectedEmployee).toLowerCase();
    const ledgerSource = (this.accountingService.accCacheData && (this.accountingService.accCacheData.LedgersALL || this.accountingService.accCacheData.Ledgers)) || [];
    this.matchedLedgers = ledgerSource.filter(l => ((l.LedgerName || "").toLowerCase().indexOf(employeeName) > -1));

    if (!this.matchedLedgers.length) {
      this.loading = false;
      this.msgBoxServ.showMessage("warning", ["No accounting ledger mapped for selected employee/doctor."]);
      return;
    }

    const postData = new LedgerReportRequest_DTO();
    postData.LedgerIds = this.matchedLedgers.map(l => l.LedgerId);
    postData.FromDate = this.fromDate;
    postData.ToDate = this.toDate;
    postData.FiscalYearId = this.fiscalYearId;
    postData.CostCenterId = -2;

    this.accountingReportsBLService.GetLedgerListReport(postData).subscribe(
      res => {
        if (res && res.Status === "OK") {
          const result = res.Results && res.Results.result ? res.Results.result : [];
          this.transactions = result || [];
          this.calculateSummary();
          this.calculateMonthlySummary();
          this.loadSubLedgerSummary(employeeName, () => this.mergePayrollMonthlyData());
        } else {
          this.loading = false;
          this.msgBoxServ.showMessage("warning", ["No transactions found for selected employee in given date range."]);
        }
      },
      () => {
        this.loading = false;
        this.msgBoxServ.showMessage("error", ["Failed to load employee financial data."]);
      }
    );
  }

  public applyRoleFilter(): void {
    if (!this.employees || !this.employees.length) {
      this.displayedEmployees = [];
      return;
    }
    if (this.roleFilter === "doctors") {
      this.displayedEmployees = this.employees.filter(e => this.isDoctor(e));
    } else if (this.roleFilter === "employees") {
      this.displayedEmployees = this.employees.filter(e => !this.isDoctor(e));
    } else {
      this.displayedEmployees = this.employees.slice();
    }
  }

  public exportToExcel(): void {
    if (!this.transactions || !this.transactions.length) {
      this.msgBoxServ.showMessage("warning", ["No data to export."]);
      return;
    }
    const lines: string[] = [];
    lines.push(`Employee Financial 360`);
    lines.push(`From,${this.fromDate},To,${this.toDate}`);
    lines.push(`Employee,${this.getEmployeeName(this.selectedEmployee)}`);
    lines.push(``);
    lines.push(`Monthly Summary`);
    lines.push(`Month,Debit,Credit,Balance,Salary,Deductions,Net Payable`);
    this.monthlySummary.forEach(m => {
      lines.push(`${m.Month},${m.Debit || 0},${m.Credit || 0},${m.Balance || 0},${m.SalaryAmount || 0},${m.DeductionAmount || 0},${m.NetPayable || 0}`);
    });
    lines.push(``);
    lines.push(`Transaction Details`);
    lines.push(`Date,Voucher No,Voucher Type,Description,Debit,Credit`);
    this.transactions.forEach(t => {
      const desc = ((t.Description || "") + "").replace(/,/g, " ");
      lines.push(`${t.TransactionDate || ""},${t.VoucherNumber || ""},${t.VoucherName || ""},${desc},${t.LedgerDr || 0},${t.LedgerCr || 0}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employee-financial-360-${moment().format("YYYYMMDD-HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public printReport(): void {
    const root = document.getElementById("employee-financial-360-print");
    if (!root) {
      this.msgBoxServ.showMessage("error", ["Printable section not found."]);
      return;
    }
    const popup = window.open("", "_blank", "width=1100,height=750,scrollbars=yes");
    if (!popup) {
      this.msgBoxServ.showMessage("error", ["Unable to open print window."]);
      return;
    }
    popup.document.open();
    popup.document.write(
      `<html><head><title>Employee Financial 360</title>` +
      `<link rel="stylesheet" type="text/css" href="../../../assets/global/plugins/bootstrap/css/bootstrap.min.css"/>` +
      `</head><body onload="window.print()">${root.innerHTML}</body></html>`
    );
    popup.document.close();
  }

  private loadEmployees(): void {
    this.accountingSettingsBLService.GetEmployeeList().subscribe(
      res => {
        if (res && res.Status === "OK") {
          this.employees = res.Results || [];
          this.applyRoleFilter();
        }
      },
      () => {
        this.employees = [];
        this.displayedEmployees = [];
      }
    );
  }

  private loadSubLedgerSummary(employeeName: string, done?: () => void): void {
    this.accountingSettingsBLService.GetSubLedger().subscribe(
      res => {
        const allSubledgers = (res && res.Status === "OK" && res.Results) ? res.Results : [];
        this.matchedSubLedgers = allSubledgers.filter(s => ((s.SubLedgerName || "").toLowerCase().indexOf(employeeName) > -1));

        if (!this.matchedSubLedgers.length) {
          this.loading = false;
          if (done) { done(); }
          return;
        }

        const subPostData = new SubLedgerReportRequest_DTO();
        subPostData.SubLedgerIds = this.matchedSubLedgers.map(s => s.SubLedgerId);
        subPostData.FromDate = this.fromDate;
        subPostData.ToDate = this.toDate;
        subPostData.FiscalYearId = this.fiscalYearId;

        this.accountingReportsBLService.GetSubLedgerReport(subPostData).subscribe(
          subRes => {
            if (subRes && subRes.Status === "OK" && subRes.Results) {
              const openingData = subRes.Results.OpeningData || [];
              const txnData = subRes.Results.TransactionData || [];
              let openingTotal = 0;
              let closingTotal = 0;
              openingData.forEach(o => {
                openingTotal += (o.OpeningBalance || 0);
              });
              const txnDelta = txnData.reduce((acc, t) => acc + (t.DrAmount || 0) - (t.CrAmount || 0), 0);
              closingTotal = openingTotal + txnDelta;

              this.subLedgerSummary.OpeningDr = openingTotal > 0 ? openingTotal : 0;
              this.subLedgerSummary.OpeningCr = openingTotal < 0 ? Math.abs(openingTotal) : 0;
              this.subLedgerSummary.ClosingDr = closingTotal > 0 ? closingTotal : 0;
              this.subLedgerSummary.ClosingCr = closingTotal < 0 ? Math.abs(closingTotal) : 0;
            }
            this.loading = false;
            if (done) { done(); }
          },
          () => {
            this.loading = false;
            if (done) { done(); }
          }
        );
      },
      () => {
        this.loading = false;
        if (done) { done(); }
      }
    );
  }

  private calculateSummary(): void {
    let totalDr = 0;
    let totalCr = 0;
    let paymentOut = 0;
    let paymentIn = 0;
    let advanceGiven = 0;
    let advanceRecovered = 0;

    this.transactions.forEach(txn => {
      const dr = this.toNumber(txn.LedgerDr);
      const cr = this.toNumber(txn.LedgerCr);
      totalDr += dr;
      totalCr += cr;

      const voucher = ((txn.VoucherName || "") + "").toLowerCase();
      const description = ((txn.Description || "") + "").toLowerCase();
      if (voucher.indexOf("payment") > -1) {
        paymentOut += dr;
        paymentIn += cr;
      }
      if (description.indexOf("advance") > -1) {
        advanceGiven += dr;
        advanceRecovered += cr;
      }
    });

    this.summary.TotalDebit = totalDr;
    this.summary.TotalCredit = totalCr;
    this.summary.NetBalance = totalDr - totalCr;
    this.summary.PaymentOut = paymentOut;
    this.summary.PaymentIn = paymentIn;
    this.summary.AdvanceGiven = advanceGiven;
    this.summary.AdvanceRecovered = advanceRecovered;
  }

  private calculateMonthlySummary(): void {
    const monthMap: any = {};
    this.transactions.forEach(txn => {
      const monthKey = this.getMonthKey(txn.TransactionDate);
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { Month: monthKey, Debit: 0, Credit: 0, SalaryAmount: 0, DeductionAmount: 0, NetPayable: 0, PayrollMerged: false };
      }
      monthMap[monthKey].Debit += this.toNumber(txn.LedgerDr);
      monthMap[monthKey].Credit += this.toNumber(txn.LedgerCr);
    });

    this.monthlySummary = Object.keys(monthMap)
      .sort()
      .map(k => {
        const row = monthMap[k];
        row.Balance = row.Debit - row.Credit;
        return row;
      });
  }

  private mergePayrollMonthlyData(): void {
    this.payrollMergeStatus = "";
    if (!this.selectedEmployee || !this.monthlySummary.length) {
      return;
    }
    const employeeId = this.selectedEmployee.EmployeeId || this.selectedEmployee.EmpId || this.selectedEmployee.Id;
    if (!employeeId) {
      this.payrollMergeStatus = "Payroll merge skipped: selected employee id not found.";
      return;
    }

    const monthKeys = this.monthlySummary.map(m => m.Month);
    if (!monthKeys.length) { return; }

    this.payrollMergeStatus = "Merging monthly salary and deductions...";
    this.mergePayrollForMonthAtIndex(0, monthKeys, employeeId, false);
  }

  private mergePayrollForMonthAtIndex(index: number, monthKeys: string[], employeeId: number, gotAny: boolean): void {
    if (index >= monthKeys.length) {
      this.finalizePayrollMerge(gotAny);
      return;
    }

    const monthKey = monthKeys[index];
    const year = monthKey.split("-")[0];
    const month = monthKey.split("-")[1];
    this.http.get<any>(`/api/Payroll?reqType=get-emp-list&Year=${year}&Month=${month}&CurrEmpId=${employeeId}`)
      .subscribe(
        res => {
          let hasData = gotAny;
          if (res && res.Status === "OK" && res.Results && res.Results.length) {
            const row = this.pickPayrollRow(res.Results, employeeId);
            if (row) {
              const monthRow = this.monthlySummary.find(m => m.Month === monthKey);
              if (monthRow) {
                monthRow.SalaryAmount = this.firstNumeric(row, ["GrossSalary", "GrossAmount", "Salary", "MonthlySalary", "BasicSalary"]);
                monthRow.DeductionAmount = this.firstNumeric(row, ["TotalDeduction", "DeductionAmount", "Deductions", "TaxDeduction"]);
                monthRow.NetPayable = this.firstNumeric(row, ["NetPayable", "NetSalary", "NetAmount", "TakeHome"]);
                monthRow.PayrollMerged = true;
                hasData = true;
              }
            }
          }
          this.mergePayrollForMonthAtIndex(index + 1, monthKeys, employeeId, hasData);
        },
        () => this.mergePayrollForMonthAtIndex(index + 1, monthKeys, employeeId, gotAny)
      );
  }

  private finalizePayrollMerge(hasData: boolean): void {
    let salaryTotal = 0;
    let deductionTotal = 0;
    let netTotal = 0;
    this.monthlySummary.forEach(m => {
      salaryTotal += this.toNumber(m.SalaryAmount);
      deductionTotal += this.toNumber(m.DeductionAmount);
      netTotal += this.toNumber(m.NetPayable);
    });
    this.summary.SalaryTotal = salaryTotal;
    this.summary.DeductionTotal = deductionTotal;
    this.summary.NetSalaryTotal = netTotal;
    this.payrollMergeStatus = hasData
      ? "Payroll merged successfully for available months."
      : "Payroll API is available but salary/deduction rows were not found for this date range.";
  }

  private pickPayrollRow(rows: any[], employeeId: number): any {
    if (!rows || !rows.length) { return null; }
    const exact = rows.find(r => (r.EmployeeId || r.EmpId || r.Id) == employeeId);
    return exact || rows[0];
  }

  private firstNumeric(obj: any, keys: string[]): number {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const val = this.toNumber(obj && obj[k] != null ? obj[k] : 0);
      if (val !== 0) { return val; }
    }
    return 0;
  }

  private isDoctor(emp: any): boolean {
    const text = `${emp && (emp.Designation || "")} ${emp && (emp.EmployeeType || "")} ${emp && (emp.FullName || "")}`.toLowerCase();
    return !!(emp && (emp.IsDoctor === true || text.indexOf("doctor") > -1 || text.indexOf("consultant") > -1));
  }

  private getMonthKey(dateVal: string): string {
    if (!dateVal) { return "Unknown"; }
    const m = moment(dateVal, ["YYYY-MM-DD", "YYYY-MM-DD HH:mm", moment.ISO_8601], true);
    if (m.isValid()) {
      return m.format("YYYY-MM");
    }
    return (dateVal + "").substring(0, 7);
  }

  private getEmployeeName(emp: any): string {
    return (emp && (emp.FullName || emp.EmployeeName || emp.ShortName || emp.Name)) || "";
  }

  private toNumber(val: any): number {
    const n = Number(val || 0);
    return isNaN(n) ? 0 : n;
  }

  private resetData(): void {
    this.matchedLedgers = [];
    this.matchedSubLedgers = [];
    this.transactions = [];
    this.monthlySummary = [];
    this.summary = {
      TotalDebit: 0,
      TotalCredit: 0,
      NetBalance: 0,
      PaymentOut: 0,
      PaymentIn: 0,
      AdvanceGiven: 0,
      AdvanceRecovered: 0,
      SalaryTotal: 0,
      DeductionTotal: 0,
      NetSalaryTotal: 0
    };
    this.subLedgerSummary = {
      OpeningDr: 0,
      OpeningCr: 0,
      ClosingDr: 0,
      ClosingCr: 0
    };
    this.payrollMergeStatus = "";
  }
}

