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
  public selectedEmployee: any = null;

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
    AdvanceRecovered: 0
  };

  public subLedgerSummary = {
    OpeningDr: 0,
    OpeningCr: 0,
    ClosingDr: 0,
    ClosingCr: 0
  };

  public loading: boolean = false;

  constructor(
    public accountingReportsBLService: AccountingReportsBLService,
    public accountingSettingsBLService: AccountingSettingsBLService,
    public accountingService: AccountingService,
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
          this.loadSubLedgerSummary(employeeName);
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

  private loadEmployees(): void {
    this.accountingSettingsBLService.GetEmployeeList().subscribe(
      res => {
        if (res && res.Status === "OK") {
          this.employees = res.Results || [];
        }
      },
      () => {
        this.employees = [];
      }
    );
  }

  private loadSubLedgerSummary(employeeName: string): void {
    this.accountingSettingsBLService.GetSubLedger().subscribe(
      res => {
        const allSubledgers = (res && res.Status === "OK" && res.Results) ? res.Results : [];
        this.matchedSubLedgers = allSubledgers.filter(s => ((s.SubLedgerName || "").toLowerCase().indexOf(employeeName) > -1));

        if (!this.matchedSubLedgers.length) {
          this.loading = false;
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
          },
          () => { this.loading = false; }
        );
      },
      () => { this.loading = false; }
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
        monthMap[monthKey] = { Month: monthKey, Debit: 0, Credit: 0 };
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

  private getMonthKey(dateVal: string): string {
    if (!dateVal) { return "Unknown"; }
    const m = moment(dateVal, ["YYYY-MM-DD", "YYYY-MM-DD HH:mm", moment.ISO_8601], true);
    if (m.isValid()) {
      return m.format("YYYY-MM");
    }
    // Fallback for non-standard date strings
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
      AdvanceRecovered: 0
    };
    this.subLedgerSummary = {
      OpeningDr: 0,
      OpeningCr: 0,
      ClosingDr: 0,
      ClosingCr: 0
    };
  }
}

