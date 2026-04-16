import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core'
import { Chart } from 'chart.js';
import { DanpheChartsService } from '../../dashboards/shared/danphe-charts.service';
import { DLService } from "../../shared/dl.service";
import * as moment from 'moment/moment';
import { forkJoin } from 'rxjs';
import { CoreService } from '../../core/shared/core.service'

type DashboardChartMap = {
  patientDaily?: any;
  treatmentCost?: any;
  departmentWise?: any;
  labTrending?: any;
  labMembership?: any;
  billingMembership?: any;
  billingRank?: any;
};

type SummaryRow = {
  Label?: string;
  Total?: number;
};

type DepartmentAppointment = {
  DepartmentName: string;
  AppointmentCount: number;
};

type PatientDailyCount = {
  Label: string;
  PatientCount: number;
  VisitType: string;
};

type TreatmentCostRow = {
  Gender: string;
  AgeRange: string;
  Total: number;
};

type HospitalManagementRow = {
  Label: string;
  Count: number;
  Percentage?: number;
};

type WardSummary = {
  Ward: string;
  InBed: number;
  NewAdmission: number;
  TransIn: number;
  TransOut: number;
  Discharged: number;
  Total: number;
};

type EmergencySummary = {
  TotalRegisteredPatients: number;
  MildPatients: number;
  ModeratePatients: number;
  CriticalPatients: number;
  DeathPatients: number;
  TotalTriagedPatients: number;
  LAMAPatients: number;
  AdmittedPatients: number;
  TransferredPatients: number;
  DischargedPatients: number;
  TotalFinalizedPatients: number;
};

type MembershipCountRow = {
  MembershipTypeName: string;
  TotalCount?: number;
  Total?: number;
};

type RankCountRow = {
  Rank: string;
  Total?: number;
};

type TrendingTestRow = {
  LabTestName: string;
  Counts: number;
};

type BillingMembershipRow = {
  MembershipTypeName: string;
  Total: number;
};

type DashboardPanel = {
  key: string;
  title: string;
  subtitle: string;
  fromDate: string;
  toDate: string;
  loading: boolean;
  patientCards: SummaryRow[];
  doctorCards: SummaryRow[];
  readmissionCards: SummaryRow[];
  patientCountByDay: PatientDailyCount[];
  treatmentCostRows: TreatmentCostRow[];
  departmentAppointments: DepartmentAppointment[];
  hospitalManagement: HospitalManagementRow[];
  wardSummary: WardSummary[];
  totalAdmittedPatients: number;
  totalDischargedPatients: number;
  emergencySummary: EmergencySummary;
  labMembership: MembershipCountRow[];
  labTrending: TrendingTestRow[];
  billingMembership: BillingMembershipRow[];
  billingRank: RankCountRow[];
};
@Component({
  selector: 'my-app',
  templateUrl: "./dashboard-home.html",
  styleUrls: ["./dashboard-home.component.css"]
})


export class DashboardHomeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('carouselContainer') carouselContainer: ElementRef;

  public currentDate: string = "";
  public showCountryMap: boolean = true;
  public activePanelIndex: number = 0;
  public panels: DashboardPanel[] = [];
  private chartRefs: { [key: string]: DashboardChartMap } = {};
  private colorPalette: string[] = ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#26A69A', '#546E7A', '#D10CE8'];

  constructor(
    public danpheCharts: DanpheChartsService,
    public dlService: DLService,
    public coreService: CoreService,
    public changeDetector: ChangeDetectorRef
  ) {
    this.currentDate = moment().format("DD-MM-YYYY");
    this.showCountryMap = this.coreService.showCountryMapOnLandingPage;
  }

  ngOnInit() {
    this.panels = this.buildPanels();
    this.panels.forEach(panel => this.loadAnalyticsForRange(panel));
  }

  ngAfterViewInit() {
    this.scrollToPanel(this.activePanelIndex);
  }

  ngOnDestroy() {
    Object.keys(this.chartRefs).forEach(key => this.destroyCharts(key));
  }

  public setActivePanel(index: number) {
    this.activePanelIndex = index;
    this.scrollToPanel(index);
  }

  public onPanelScroll() {
    if (!this.carouselContainer || !this.carouselContainer.nativeElement) {
      return;
    }
    const container = this.carouselContainer.nativeElement;
    const index = Math.round(container.scrollLeft / Math.max(container.clientWidth, 1));
    this.activePanelIndex = index;
  }

  private scrollToPanel(index: number) {
    if (!this.carouselContainer || !this.carouselContainer.nativeElement) {
      return;
    }
    const container = this.carouselContainer.nativeElement;
    const targetLeft = container.clientWidth * index;
    try {
      if (container.scrollTo) {
        container.scrollTo(targetLeft, 0);
      } else {
        container.scrollLeft = targetLeft;
      }
    }
    catch (ex) {
      container.scrollLeft = targetLeft;
    }
  }

  private buildPanels(): DashboardPanel[] {
    const today = moment();
    const previousMonthStart = moment().subtract(1, 'month').startOf('month');
    const previousMonthEnd = moment().subtract(1, 'month').endOf('month');
    return [
      this.createPanel('month', '1 Month', 'Rolling last month', today.clone().subtract(1, 'month').format('YYYY-MM-DD'), today.format('YYYY-MM-DD')),
      this.createPanel('previous-month', 'Previous Month', previousMonthStart.format('MMM YYYY'), previousMonthStart.format('YYYY-MM-DD'), previousMonthEnd.format('YYYY-MM-DD')),
      this.createPanel('year', 'Year', 'Rolling last 12 months', today.clone().subtract(12, 'month').format('YYYY-MM-DD'), today.format('YYYY-MM-DD'))
    ];
  }

  private createPanel(key: string, title: string, subtitle: string, fromDate: string, toDate: string): DashboardPanel {
    return {
      key: key,
      title: title,
      subtitle: subtitle,
      fromDate: fromDate,
      toDate: toDate,
      loading: true,
      patientCards: [],
      doctorCards: [],
      readmissionCards: [],
      patientCountByDay: [],
      treatmentCostRows: [],
      departmentAppointments: [],
      hospitalManagement: [],
      wardSummary: [],
      totalAdmittedPatients: 0,
      totalDischargedPatients: 0,
      emergencySummary: {
        TotalRegisteredPatients: 0,
        MildPatients: 0,
        ModeratePatients: 0,
        CriticalPatients: 0,
        DeathPatients: 0,
        TotalTriagedPatients: 0,
        LAMAPatients: 0,
        AdmittedPatients: 0,
        TransferredPatients: 0,
        DischargedPatients: 0,
        TotalFinalizedPatients: 0
      },
      labMembership: [],
      labTrending: [],
      billingMembership: [],
      billingRank: []
    };
  }

  public loadAnalyticsForRange(panel: DashboardPanel) {
    panel.loading = true;
    this.loadPatientCards(panel);
    this.loadPatientDailyCount(panel);
    this.loadTreatmentCost(panel);
    this.loadDepartmentAppointments(panel);
    this.loadHospitalManagement(panel);
    this.loadBedAndAdt(panel);
    this.loadEmergencySummary(panel);
    this.loadLabMembership(panel);
    this.loadLabTrending(panel);
    this.loadBillingMembership(panel);
    this.loadBillingRank(panel);
  }

  private loadPatientCards(panel: DashboardPanel) {
    this.dlService.Read(`/PatientDashboard/GetPatientDashboardCardSummaryCalculation?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK' && res.Results) {
        panel.patientCards = res.Results.Patients || [];
        panel.doctorCards = res.Results.Doctors || [];
        panel.readmissionCards = res.Results.ReAdmission || [];
      }
    });
  }

  private loadPatientDailyCount(panel: DashboardPanel) {
    this.dlService.Read(`/PatientDashboard/GetPatientCountByDay?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK') {
        panel.patientCountByDay = res.Results || [];
        this.safeRender(() => this.renderPatientDailyChart(panel));
      }
    });
  }

  private loadTreatmentCost(panel: DashboardPanel) {
    this.dlService.Read(`/PatientDashboard/GetAverageTreatmentCostbyAgeGroup?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK') {
        panel.treatmentCostRows = res.Results || [];
        this.safeRender(() => this.renderTreatmentCostChart(panel));
      }
    });
  }

  private loadDepartmentAppointments(panel: DashboardPanel) {
    this.dlService.Read(`/PatientDashboard/GetDepartmentWiseAppointment?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK') {
        panel.departmentAppointments = res.Results || [];
        this.safeRender(() => this.renderDepartmentWiseChart(panel));
      }
    });
  }

  private loadHospitalManagement(panel: DashboardPanel) {
    this.dlService.Read(`/PatientDashboard/GetHospitalManagement?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK') {
        panel.hospitalManagement = res.Results || [];
        const max = Math.max.apply(null, panel.hospitalManagement.map(a => a.Count).concat([0]));
        panel.hospitalManagement.forEach(item => {
          item.Percentage = max > 0 ? Math.round((item.Count / max) * 100) : 0;
        });
      }
    });
  }

  private loadBedAndAdt(panel: DashboardPanel) {
    const totalDischargedPatients$ = this.dlService.Read(`/Reporting/DischargedPatient?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).map(r => r);
    const totalAdmittedPatients$ = this.dlService.Read(`/Reporting/TotalAdmittedPatient?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).map(r => r);
    const inpatientCensusWardWise$ = this.dlService.Read(`/Reporting/AllWardCountDetail?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).map(r => r);

    forkJoin([totalDischargedPatients$, totalAdmittedPatients$, inpatientCensusWardWise$]).subscribe((res: any[]) => {
      if (res && res.length > 2) {
        panel.totalDischargedPatients = res[0] && res[0].Results ? res[0].Results.length : 0;
        panel.totalAdmittedPatients = res[1] && res[1].Results ? res[1].Results.length : 0;
        panel.wardSummary = res[2] && res[2].Results ? res[2].Results : [];
      }
    });
  }

  private loadEmergencySummary(panel: DashboardPanel) {
    this.dlService.Read(`/Reporting/ERDashboard?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`)
      .map(res => res)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results && res.Results.JsonData) {
          const dashboardStats = JSON.parse(res.Results.JsonData);
          if (dashboardStats && dashboardStats.LabelData && dashboardStats.LabelData.length > 0) {
            panel.emergencySummary = dashboardStats.LabelData[0];
          }
        }
      });
  }

  private loadLabMembership(panel: DashboardPanel) {
    this.dlService.Read(`/Reporting/LabDashboardMembershipWiseTestCount?FromDate=${panel.fromDate}&Todate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK') {
        panel.labMembership = res.Results || [];
        this.safeRender(() => this.renderLabMembershipChart(panel));
      }
    });
  }

  private loadLabTrending(panel: DashboardPanel) {
    this.dlService.Read(`/Reporting/LabDashboardTrendingTestCount?FromDate=${panel.fromDate}&Todate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK') {
        panel.labTrending = res.Results || [];
        this.safeRender(() => this.renderLabTrendingChart(panel));
      }
    });
  }

  private loadBillingMembership(panel: DashboardPanel) {
    this.dlService.Read(`/Reporting/BillingDashboardMembershipWisePatientInvoiceCount?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK') {
        panel.billingMembership = res.Results || [];
        this.safeRender(() => this.renderBillingMembershipChart(panel));
      }
    });
  }

  private loadBillingRank(panel: DashboardPanel) {
    this.dlService.Read(`/Reporting/BillingDashboardRankWisePatientInvoiceCount?FromDate=${panel.fromDate}&ToDate=${panel.toDate}`).subscribe((res: any) => {
      if (res && res.Status === 'OK') {
        panel.billingRank = res.Results || [];
        this.safeRender(() => {
          this.renderBillingRankChart(panel);
          panel.loading = false;
        });
      } else {
        panel.loading = false;
      }
    }, () => panel.loading = false);
  }

  public sumPatientCount(panel: DashboardPanel): number {
    return panel.patientCountByDay.reduce((sum, item) => sum + (item.PatientCount || 0), 0);
  }

  public totalAppointments(panel: DashboardPanel): number {
    return panel.departmentAppointments.reduce((sum, item) => sum + (item.AppointmentCount || 0), 0);
  }

  public totalDoctors(panel: DashboardPanel): number {
    return panel.doctorCards.reduce((sum, item) => sum + (item.Total || 0), 0);
  }

  public totalReadmissions(panel: DashboardPanel): number {
    return panel.readmissionCards.reduce((sum, item) => sum + (item.Total || 0), 0);
  }

  public totalInBed(panel: DashboardPanel): number {
    return panel.wardSummary.reduce((sum, item) => sum + (item.InBed || 0), 0);
  }

  public totalLabMembership(panel: DashboardPanel): number {
    return panel.labMembership.reduce((sum, item) => sum + (item.TotalCount || 0), 0);
  }

  public totalBillingMembership(panel: DashboardPanel): number {
    return panel.billingMembership.reduce((sum, item) => sum + (item.Total || 0), 0);
  }

  private renderPatientDailyChart(panel: DashboardPanel) {
    const inpatient = panel.patientCountByDay.filter(a => (a.VisitType || '').toLowerCase() === 'inpatient');
    const outpatient = panel.patientCountByDay.filter(a => (a.VisitType || '').toLowerCase() === 'outpatient');
    this.destroySingleChart(panel.key, 'patientDaily');
    this.chartRefs[panel.key].patientDaily = new Chart(`patientDailyChart-${panel.key}`, {
      type: 'bar',
      data: {
        labels: this.unique(inpatient.concat(outpatient).map(a => a.Label)),
        datasets: [
          { label: 'In Patient', data: inpatient.map(a => a.PatientCount), backgroundColor: '#008FFB' },
          { label: 'Out Patient', data: outpatient.map(a => a.PatientCount), backgroundColor: '#00E396' }
        ]
      },
      options: this.commonChartOptions(true)
    });
  }

  private renderTreatmentCostChart(panel: DashboardPanel) {
    const maleRows = panel.treatmentCostRows.filter(a => a.Gender === 'Male');
    const femaleRows = panel.treatmentCostRows.filter(a => a.Gender === 'Female');
    const otherRows = panel.treatmentCostRows.filter(a => a.Gender === 'Others');
    this.destroySingleChart(panel.key, 'treatmentCost');
    this.chartRefs[panel.key].treatmentCost = new Chart(`treatmentCostChart-${panel.key}`, {
      type: 'horizontalBar',
      data: {
        labels: maleRows.map(a => a.AgeRange),
        datasets: [
          { label: 'Male', data: maleRows.map(a => a.Total), backgroundColor: '#FF4560' },
          { label: 'Female', data: femaleRows.map(a => a.Total), backgroundColor: '#00E396' },
          { label: 'Others', data: otherRows.map(a => a.Total), backgroundColor: '#775DD0' }
        ]
      },
      options: this.commonChartOptions(true)
    });
  }

  private renderDepartmentWiseChart(panel: DashboardPanel) {
    this.destroySingleChart(panel.key, 'departmentWise');
    this.chartRefs[panel.key].departmentWise = new Chart(`departmentChart-${panel.key}`, {
      type: 'doughnut',
      data: {
        labels: panel.departmentAppointments.map(a => a.DepartmentName),
        datasets: [{
          data: panel.departmentAppointments.map(a => a.AppointmentCount),
          backgroundColor: this.getColorSet(panel.departmentAppointments.length)
        }]
      },
      options: this.commonChartOptions(false, 'right')
    });
  }

  private renderLabTrendingChart(panel: DashboardPanel) {
    this.destroySingleChart(panel.key, 'labTrending');
    this.chartRefs[panel.key].labTrending = new Chart(`labTrendingChart-${panel.key}`, {
      type: 'bar',
      data: {
        labels: panel.labTrending.map(a => a.LabTestName),
        datasets: [{
          label: 'Lab Tests',
          data: panel.labTrending.map(a => a.Counts),
          backgroundColor: '#18E3D8'
        }]
      },
      options: this.commonChartOptions(false)
    });
  }

  private renderLabMembershipChart(panel: DashboardPanel) {
    this.destroySingleChart(panel.key, 'labMembership');
    this.chartRefs[panel.key].labMembership = new Chart(`labMembershipChart-${panel.key}`, {
      type: 'pie',
      data: {
        labels: panel.labMembership.map(a => a.MembershipTypeName),
        datasets: [{
          data: panel.labMembership.map(a => a.TotalCount || 0),
          backgroundColor: this.getColorSet(panel.labMembership.length)
        }]
      },
      options: this.commonChartOptions(false, 'right')
    });
  }

  private renderBillingMembershipChart(panel: DashboardPanel) {
    this.destroySingleChart(panel.key, 'billingMembership');
    this.chartRefs[panel.key].billingMembership = new Chart(`billingMembershipChart-${panel.key}`, {
      type: 'pie',
      data: {
        labels: panel.billingMembership.map(a => a.MembershipTypeName),
        datasets: [{
          data: panel.billingMembership.map(a => a.Total || 0),
          backgroundColor: this.getColorSet(panel.billingMembership.length)
        }]
      },
      options: this.commonChartOptions(false, 'right')
    });
  }

  private renderBillingRankChart(panel: DashboardPanel) {
    this.destroySingleChart(panel.key, 'billingRank');
    this.chartRefs[panel.key].billingRank = new Chart(`billingRankChart-${panel.key}`, {
      type: 'bar',
      data: {
        labels: panel.billingRank.map(a => a.Rank),
        datasets: [{
          label: 'Invoices',
          data: panel.billingRank.map(a => a.Total || 0),
          backgroundColor: '#FEB019'
        }]
      },
      options: this.commonChartOptions(false)
    });
  }

  private commonChartOptions(showLegend: boolean, legendPosition: string = 'bottom') {
    return {
      maintainAspectRatio: false,
      legend: {
        display: showLegend,
        position: legendPosition,
        labels: {
          usePointStyle: true,
          boxWidth: 8
        }
      },
      scales: {
        xAxes: [{ gridLines: { display: false } }],
        yAxes: [{ gridLines: { display: false }, ticks: { beginAtZero: true } }]
      }
    };
  }

  private safeRender(callback: Function) {
    setTimeout(() => {
      try {
        this.changeDetector.detectChanges();
        callback();
      }
      catch (ex) {
        console.error('Homepage analytics chart render failed.', ex);
      }
    }, 0);
  }

  private unique(values: string[]): string[] {
    return values.filter((item, index) => values.indexOf(item) === index);
  }

  private getColorSet(count: number): string[] {
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(this.colorPalette[i % this.colorPalette.length]);
    }
    return colors;
  }

  private destroyCharts(key: string) {
    const current = this.chartRefs[key];
    if (!current) {
      return;
    }
    Object.keys(current).forEach(chartKey => this.destroySingleChart(key, chartKey));
  }

  private destroySingleChart(key: string, chartKey: string) {
    if (!this.chartRefs[key]) {
      this.chartRefs[key] = {};
    }
    const chart = this.chartRefs[key][chartKey];
    if (chart) {
      chart.destroy();
      this.chartRefs[key][chartKey] = null;
    }
  }
}
