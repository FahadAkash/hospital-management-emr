import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { Lightbox } from 'angular2-lightbox';
import * as moment from 'moment/moment';
import { CoreService } from "../../core/shared/core.service";
import { CommonFunctions } from '../../shared/common.functions';
import { MessageboxService } from '../../shared/messagebox/messagebox.service';
import { PatientFilesModel } from '../shared/patient-files.model';
import { PatientsBLService } from '../shared/patients.bl.service';
@Component({
    selector: "patient-history",
    templateUrl: "./patient-history.html"
})
export class PatientHistoryComponent {
    public patientId: number = 0;
    public labHistory: any;
    public imagingHistory: any;
    public billingHistory: any;
    public visitHistory: any;
    public drugDetails: any;
    public uploadedDocuments: any;
    public admissionHistory: any;
    public showVisitDetails: boolean = true;
    public showAdmissionDetails: boolean = false;
    public showDrugDetails: boolean = false;
    public showLabDetails: boolean = false;
    public showRadiologyDetails: boolean = false;
    public showBillDetails: boolean = false;
    public showDocumentsDetails: boolean = false;
    public showDischargeSummary: boolean = false;
    public showPatientHistory: boolean = false;
    public showuploadedDocuments: boolean = false;
    public showImage: boolean = false;
    public isShowUploadMode: boolean = false;
    public isShowListMode: boolean = false;
    public showUploadFiles: boolean = false;
    public album = [];
    @Input("selectedPatient")
    public selectedPatient: any;

    /////For Binding the Image to Popup box 
    public PopupImageData: PatientFilesModel = new PatientFilesModel();

    public totalBillAmount: number = 0;
    public paidAmount: number = 0;
    public cancelledBillAmount: number = 0;
    public unpaidBillAmount: number = 0;
    public returnedAmount: number = 0;
    public depositAmount: number = 0;
    public discountAmount: number = 0;
    public balance: number = 0;
    public checkouttimeparameter: string;
    public dischargeSummary: any = {
        TotalAdmissions: 0,
        BedMovementCount: 0,
        TotalBedDays: 0,
        TotalMedicines: 0,
        TotalLabTests: 0,
        TotalImagingTests: 0,
        BedCharges: 0,
        MedicineCharges: 0,
        LabCharges: 0,
        RadiologyCharges: 0,
        OtherCharges: 0,
        NetReceivable: 0
    };





    constructor(public patientBLService: PatientsBLService, public lightbox: Lightbox, public changeDetector: ChangeDetectorRef,
        public msgBoxServ: MessageboxService, public coreService: CoreService) {
        this.checkouttimeparameter = this.coreService.Parameters.find(p => p.ParameterGroupName == "ADT" && p.ParameterName == "CheckoutTime").ParameterValue;
    }

    @Input("showPatientHistory")
    public set value(val: boolean) {
        this.showPatientHistory = val;
        if (this.showPatientHistory) {
            this.getPatientVisitList();
            this.getDrugHistory();
            this.getAdmissionHistory();
            this.getLabResult();
            this.getImagingResult();
            this.getBillingHistory();
            this.changeDetector.detectChanges();
            this.isShowUploadMode = false;
            this.isShowListMode = true;
            this.patientId = this.selectedPatient.PatientId;
        }
    }

    public getLabResult() {
        this.patientBLService.GetPatientLabReport(this.selectedPatient.PatientId)
            .subscribe(res => {
                if (res.Status == 'OK') {
                    if (res.Results)
                        this.labHistory = res.Results;
                    this.labHistory = this.labHistory.filter(a => a.Components.length > 0);
                    this.buildDischargeSummary();
                }
                else {
                    this.msgBoxServ.showMessage("error", [res.ErrorMessage]);
                }
            },
                err => {
                    this.msgBoxServ.showMessage("error", ["Failed to get Lab Results"]);
                });
    }
    public getAdmissionHistory() {
        this.patientBLService.GetAdmissionHistory(this.selectedPatient.PatientId)
            .subscribe(res => {
                if (res.Status == 'OK') {
                    if (res.Results)
                        this.admissionHistory = res.Results;
                    var adt = this.admissionHistory;
                    this.calculateDays();
                    this.buildDischargeSummary();
                }
                else {
                    this.msgBoxServ.showMessage("error", [res.ErrorMessage]);
                }
            },
                err => {
                    this.msgBoxServ.showMessage("error", ["Failed to get Lab Results"]);
                });
    }
    public calculateDays() {
        this.admissionHistory.forEach(adt => {
            adt.BedInformations.forEach(bed => {
                //calculate days
                var duration = CommonFunctions.calculateADTBedDuration(bed.StartDate, bed.EndDate, this.checkouttimeparameter);
                if (duration.days > 0 && duration.hours)
                    bed.Days = duration.days + ' + ' + duration.hours + ' hour';
                else if (duration.days && !duration.hours)
                    bed.Days = duration.days;
                else if (!duration.days && duration.hours)
                    bed.Days = duration.hours + ' hour';
                bed.Action = bed.Action.charAt(0).toUpperCase() + bed.Action.slice(1);
            });
        });
    }
    public getPatientVisitList() {
        this.patientBLService.GetPatientVisitList(this.selectedPatient.PatientId)
            .subscribe(res => {
                if (res.Status == 'OK') {
                    if (res.Results) {
                        this.visitHistory = res.Results;
                        //this is for formatting the time to show properly in html(to show properly to the client)....
                        this.visitHistory.forEach(visit => {
                            visit.VisitTime = moment(visit.VisitTime, "hhmm").format('hh:mm A');
                        });
                    }
                }
                else {
                    this.msgBoxServ.showMessage("error", [res.ErrorMessage]);
                }
            },
                err => {
                    this.msgBoxServ.showMessage("error", ["Failed to get Visit History"]);
                });
    }

    public getImagingResult() {
        this.patientBLService.GetPatientImagingReports(this.selectedPatient.PatientId)
            .subscribe(res => {
                if (res.Status == 'OK') {
                    if (res.Results.length)
                        this.imagingHistory = res.Results;
                    this.buildDischargeSummary();
                }
                else {
                    this.msgBoxServ.showMessage("error", [res.ErrorMessage]);

                }
            },
                err => {
                    this.msgBoxServ.showMessage("error", ["Failed to get Imaging Results"]);

                });
    }
    public getBillingHistory() {
        this.patientBLService.GetPatientBillHistory(this.selectedPatient.PatientCode)
            .subscribe(res => {
                if (res.Status == 'OK') {
                    if (res.Results) {
                        this.billingHistory = res.Results;
                        this.CalculateTotal();
                        this.buildDischargeSummary();
                    }
                }
                else {
                    this.msgBoxServ.showMessage("error", [res.ErrorMessage]);
                }
            },
                err => {
                    this.msgBoxServ.showMessage("error", ["Failed to get BillingHistory"]);
                });
    }
    public getDrugHistory() {
        this.patientBLService.GetPatientDrugList(this.selectedPatient.PatientId)
            .subscribe(res => {
                if (res.Status == 'OK') {
                    if (res.Results) {
                        this.drugDetails = res.Results;
                        this.buildDischargeSummary();
                    }
                }
                else {
                    this.msgBoxServ.showMessage("error", [res.ErrorMessage]);
                }
            },
                err => {
                    this.msgBoxServ.showMessage("error", ["Failed to get BillingHistory"]);
                });
    }
    Close() {
        this.showImage = false;
        this.showPatientHistory = true;
    }
    public updateView(category: number): void {
        this.showVisitDetails = (category == 0);
        this.showAdmissionDetails = (category == 1);
        this.showDrugDetails = (category == 2);
        this.showLabDetails = (category == 3);
        this.showRadiologyDetails = (category == 4);
        this.showBillDetails = (category == 5);
        this.showDocumentsDetails = (category == 6);
        this.showDischargeSummary = (category == 7);
    }
    public CalculateTotal() {
        // reset totals to avoid double-counting when data reloads
        this.totalBillAmount = 0;
        this.paidAmount = 0;
        this.cancelledBillAmount = 0;
        this.unpaidBillAmount = 0;
        this.returnedAmount = 0;
        this.depositAmount = 0;
        this.discountAmount = 0;
        this.balance = 0;

        if (this.billingHistory.paidBill.length) {
            this.billingHistory.paidBill.forEach(bill => {
                this.paidAmount = this.paidAmount + bill.SubTotal;
                this.discountAmount = this.discountAmount + bill.Discount;
            });
        }
        if (this.billingHistory.unpaidBill.length) {
            this.billingHistory.unpaidBill.forEach(bill => {
                this.unpaidBillAmount = this.unpaidBillAmount + bill.SubTotal;
                this.discountAmount = this.discountAmount + bill.Discount;
            });
        }
        if (this.billingHistory.returnBill) {
            this.billingHistory.returnBill.forEach(bill => {
                this.returnedAmount = this.returnedAmount + bill.ReturnedAmount;
                this.discountAmount = this.discountAmount + bill.Discount;
            });

        }
        if (this.billingHistory.deposits) {
            this.billingHistory.deposits.forEach(bill => {
                if (bill.TransactionType == "Deposit")
                    this.depositAmount = this.depositAmount + bill.Amount;
                else
                    this.depositAmount = this.depositAmount - bill.Amount;
            });

        }
        if (this.billingHistory.cancelBill) {
            this.billingHistory.cancelBill.forEach(bill => {
                this.cancelledBillAmount = this.cancelledBillAmount + bill.CancelledAmount;
                this.discountAmount = this.discountAmount + bill.Discount;
            });

        }
        this.totalBillAmount = this.paidAmount + this.unpaidBillAmount + this.returnedAmount + this.cancelledBillAmount;
        this.balance = this.depositAmount - this.unpaidBillAmount;
        this.ParseAmounts();
    }

    public ParseAmounts() {
        this.paidAmount = CommonFunctions.parseAmount(this.paidAmount);
        this.returnedAmount = CommonFunctions.parseAmount(this.returnedAmount);
        this.depositAmount = CommonFunctions.parseAmount(this.depositAmount);
        this.cancelledBillAmount = CommonFunctions.parseAmount(this.cancelledBillAmount);
        this.totalBillAmount = CommonFunctions.parseAmount(this.totalBillAmount);
        this.balance = CommonFunctions.parseAmount(this.balance);
        this.discountAmount = CommonFunctions.parseAmount(this.discountAmount);
    }

    private buildDischargeSummary() {
        const summary = {
            TotalAdmissions: 0,
            BedMovementCount: 0,
            TotalBedDays: 0,
            TotalMedicines: 0,
            TotalLabTests: 0,
            TotalImagingTests: 0,
            BedCharges: 0,
            MedicineCharges: 0,
            LabCharges: 0,
            RadiologyCharges: 0,
            OtherCharges: 0,
            NetReceivable: 0
        };

        if (this.admissionHistory && this.admissionHistory.length) {
            summary.TotalAdmissions = this.admissionHistory.length;
            this.admissionHistory.forEach(adt => {
                const beds = (adt && adt.BedInformations) ? adt.BedInformations : [];
                summary.BedMovementCount += beds.length;
                beds.forEach(bed => {
                    const duration = CommonFunctions.calculateADTBedDuration(bed.StartDate, bed.EndDate, this.checkouttimeparameter);
                    const days = (duration && duration.days) ? duration.days : 0;
                    const hours = (duration && duration.hours) ? duration.hours : 0;
                    summary.TotalBedDays += (days + (hours / 24));
                });
            });
        }

        if (this.drugDetails && this.drugDetails.length) {
            summary.TotalMedicines = this.drugDetails.length;
        }

        if (this.labHistory && this.labHistory.length) {
            this.labHistory.forEach(l => {
                const components = (l && l.Components) ? l.Components : [];
                summary.TotalLabTests += components.length;
            });
        }

        if (this.imagingHistory && this.imagingHistory.length) {
            summary.TotalImagingTests = this.imagingHistory.length;
        }

        const allBillRows = []
            .concat(this.billingHistory && this.billingHistory.paidBill ? this.billingHistory.paidBill : [])
            .concat(this.billingHistory && this.billingHistory.unpaidBill ? this.billingHistory.unpaidBill : []);

        let totalRowsAmount = 0;
        allBillRows.forEach(row => {
            const amt = this.toNumber(row.Amount != null ? row.Amount : row.SubTotal);
            totalRowsAmount += amt;
            const text = `${(row.Department || '')} ${(row.Item || '')}`.toLowerCase();
            if (this.containsAny(text, ['bed', 'ward', 'admission', 'room', 'ip'])) {
                summary.BedCharges += amt;
            } else if (this.containsAny(text, ['pharmacy', 'medicine', 'drug', 'dispensary'])) {
                summary.MedicineCharges += amt;
            } else if (this.containsAny(text, ['lab', 'pathology'])) {
                summary.LabCharges += amt;
            } else if (this.containsAny(text, ['radiology', 'imaging', 'xray', 'ct', 'mri', 'usg', 'ultrasound'])) {
                summary.RadiologyCharges += amt;
            }
        });

        summary.OtherCharges = totalRowsAmount - (summary.BedCharges + summary.MedicineCharges + summary.LabCharges + summary.RadiologyCharges);
        if (summary.OtherCharges < 0) {
            summary.OtherCharges = 0;
        }

        summary.TotalBedDays = CommonFunctions.parseAmount(summary.TotalBedDays);
        summary.BedCharges = CommonFunctions.parseAmount(summary.BedCharges);
        summary.MedicineCharges = CommonFunctions.parseAmount(summary.MedicineCharges);
        summary.LabCharges = CommonFunctions.parseAmount(summary.LabCharges);
        summary.RadiologyCharges = CommonFunctions.parseAmount(summary.RadiologyCharges);
        summary.OtherCharges = CommonFunctions.parseAmount(summary.OtherCharges);
        summary.NetReceivable = CommonFunctions.parseAmount((this.unpaidBillAmount || 0) - (this.depositAmount || 0));
        this.dischargeSummary = summary;
    }

    private containsAny(text: string, keys: string[]): boolean {
        if (!text) return false;
        return keys.some(k => text.indexOf(k) > -1);
    }

    private toNumber(val: any): number {
        if (val === null || val === undefined || val === '') return 0;
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    }

    public printDischargeSummary() {
        const printElement = document.getElementById("patient-discharge-summary-print");
        if (!printElement) {
            this.msgBoxServ.showMessage("error", ["Discharge summary section not found for printing."]);
            return;
        }

        const printContents = printElement.innerHTML;
        const popupWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no,titlebar=no');
        if (!popupWindow) {
            this.msgBoxServ.showMessage("error", ["Unable to open print window. Please allow popups and try again."]);
            return;
        }

        popupWindow.document.open();
        popupWindow.document.write(
            '<html><head>' +
            '<title>Patient Discharge Summary</title>' +
            '<link href="../../assets-dph/external/global/plugins/bootstrap/css/bootstrap.min.css" rel="stylesheet" />' +
            '<link rel="stylesheet" type="text/css" href="../../themes/theme-default/DanpheStyle.css" />' +
            '</head><body onload="window.print();window.close();">' +
            printContents +
            '</body></html>'
        );
        popupWindow.document.close();
    }
}