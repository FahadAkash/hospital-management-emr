import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Chart } from 'chart.js';
import * as moment from 'moment/moment';

import { forkJoin } from 'rxjs';
import { SecurityService } from '../../security/shared/security.service';
import { CoreService } from '../../core/shared/core.service';
import { DLService } from '../../shared/dl.service';

@Component({
  selector: 'my-app',
  templateUrl: './dashboard-home.html',
  styleUrls: ['./dashboard-home.component.css']
})
export class DashboardHomeComponent implements OnInit, OnDestroy {

  public currentDate: string = '';
  public lastRefreshed: string = '';
  public loading: boolean = false;

  // Role-based visibility
  public showRevenueAnalytics: boolean = false;
  public showClinicalAnalytics: boolean = false;

  // (Optional) finer-grained visibility; currently mapped into the two flags above
  public showTopDoctors: boolean = false;
  public showDepartmentRevenueChart: boolean = false;

  // KPI values
  public todayPatientCount: number = 0;
  public yesterdayPatientCount: number = 0;
  public patientTrend: number = 0;
  public todayRevenue: number = 0;
  public occupiedBeds: number = 0;
  public erToday: number = 0;

  // Data arrays
  public topDoctors: any[] = [];
  public wardSummary: any[] = [];
  public emergencySummary: any = null;

  // Chart instances
  private patientTrendChart: any = null;
  private patientDistributionChart: any = null;
  private deptRevenueChart: any = null;
  private deptAppointmentChart: any = null;
  private labTrendChart: any = null;

  // Color palette
  private colors = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#6366f1', '#f59e0b', '#06b6d4'];

  constructor(
    public coreService: CoreService,
    public dlService: DLService,
    public changeDetector: ChangeDetectorRef,
    public router: Router,
    public securityService: SecurityService
  ) {
    this.currentDate = moment().format('ddd, DD MMM YYYY');
  }

  ngOnInit() {
    this.initializeDashboardVisibilityAndData();
  }

  private initializeDashboardVisibilityAndData(retriesLeft: number = 10) {
    const user = this.securityService.GetLoggedInUser();
    if (!user && retriesLeft > 0) {
      // Logged-in user/session may be populated a moment later during first route load.
      setTimeout(() => this.initializeDashboardVisibilityAndData(retriesLeft - 1), 250);
      return;
    }
    this.resolveDashboardVisibility();
    this.refreshAll();
  }

  private resolveDashboardVisibility() {
    const user = this.securityService.GetLoggedInUser();
    
    // If we can't resolve logged-in user, keep widgets hidden.
    if (!user) {
      this.showRevenueAnalytics = false;
      this.showClinicalAnalytics = false;
      this.showTopDoctors = false;
      this.showDepartmentRevenueChart = false;
      return;
    }

    if (user.IsSystemAdmin || (user.UserName && user.UserName.toLowerCase() === 'admin')) {
      this.showRevenueAnalytics = true;
      this.showClinicalAnalytics = true;
      this.showTopDoctors = true;
      this.showDepartmentRevenueChart = true;
      return;
    }

    // Permission-driven only.
    const canSeePermission = (permissionName: string): boolean => {
      try {
        return !!permissionName && this.securityService.HasPermission(permissionName);
      } catch (e) {
        return false;
      }
    };

    // Revenue-related widgets are based on Billing Reports access.
    const canSeeDeptRevenue =
      canSeePermission('Reports/BillingMain/DepartmentSummary') ||
      canSeePermission('Reports/BillingMain/DepartmentRevenue');

    const canSeeDoctorRevenue =
      canSeePermission('Reports/BillingMain/DoctorRevenue');

    this.showDepartmentRevenueChart = canSeeDeptRevenue;
    this.showTopDoctors = canSeeDoctorRevenue;
    this.showRevenueAnalytics = this.showDepartmentRevenueChart || this.showTopDoctors;

    // Clinical widgets are based on clinical module access.
    // (Doctors should keep seeing clinical analytics; finance-only users can still see clinical if they have access.)
    const canSeeClinical =
      canSeePermission('Doctors') ||
      canSeePermission('Patient') ||
      canSeePermission('Appointment') ||
      canSeePermission('ADTMain') ||
      canSeePermission('Emergency') ||
      canSeePermission('Reports/AppointmentMain') ||
      canSeePermission('Reports/AdmissionMain') ||
      canSeePermission('Reports/LabMain');
    this.showClinicalAnalytics = canSeeClinical;

    // IMPORTANT:
    // Do not use department/position keyword fallbacks here.
    // Dashboard visibility must stay permission/navigation-driven only.
  }

  ngOnDestroy() {
    this.destroyAllCharts();
  }

  public refreshAll() {
    // Re-evaluate permissions before every refresh/navigation return.
    this.resolveDashboardVisibility();
    this.loading = true;
    this.lastRefreshed = moment().format('HH:mm:ss');

    const today = moment().format('YYYY-MM-DD');
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
    const monthStart = moment().startOf('month').format('YYYY-MM-DD');
    const sixMonthsAgo = moment().subtract(6, 'month').format('YYYY-MM-DD');

    // 1. Today's patient count
    if (this.showClinicalAnalytics) {
      this.loadTodayPatients(today, yesterday);
    }

    // 2. Today's revenue (department revenue)
    if (this.showRevenueAnalytics) {
      this.loadTodayRevenue(today);
    }

    // 3. Bed/ward summary
    if (this.showClinicalAnalytics) {
      this.loadWardSummary(monthStart, today);
    }

    // 4. Emergency summary
    if (this.showClinicalAnalytics) {
      this.loadEmergencySummary(today);
    }

    // 5. Patient Trends (monthly - last 6 months)
    if (this.showClinicalAnalytics) {
      this.loadPatientTrends(sixMonthsAgo, today);
    }

    // 6. Patient Distribution (department appointments today)
    if (this.showClinicalAnalytics) {
      this.loadPatientDistribution(today);
    }

    // 7. Department Revenue chart (today)
    if (this.showRevenueAnalytics && this.showDepartmentRevenueChart) {
      this.loadDepartmentRevenue(today);
    }

    // 8. Top Performing Doctors (this month)
    if (this.showRevenueAnalytics && this.showTopDoctors) {
      this.loadTopDoctors(monthStart, today);
    }

    // 9. Trending Lab Tests
    if (this.showClinicalAnalytics) {
      this.loadLabTrending(monthStart, today);
    }

    // 10. Department Appointments (this month)
    if (this.showClinicalAnalytics) {
      this.loadDeptAppointments(monthStart, today);
    }

    // Mark loading done after a short delay
    setTimeout(() => { this.loading = false; }, 3000);
  }

  // ========== DATA LOADERS ==========

  private loadTodayPatients(today: string, yesterday: string) {
    // Today
    this.dlService.Read(`/PatientDashboard/GetPatientCountByDay?FromDate=${today}&ToDate=${today}`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results) {
          this.todayPatientCount = (res.Results as any[]).reduce((sum, r) => sum + (r.PatientCount || 0), 0);
        }
      });
    // Yesterday (for trend)
    this.dlService.Read(`/PatientDashboard/GetPatientCountByDay?FromDate=${yesterday}&ToDate=${yesterday}`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results) {
          this.yesterdayPatientCount = (res.Results as any[]).reduce((sum, r) => sum + (r.PatientCount || 0), 0);
          if (this.yesterdayPatientCount > 0) {
            this.patientTrend = Math.round(((this.todayPatientCount - this.yesterdayPatientCount) / this.yesterdayPatientCount) * 100);
          } else {
            this.patientTrend = this.todayPatientCount > 0 ? 100 : 0;
          }
        }
      });
  }

  private loadTodayRevenue(today: string) {
    this.dlService.Read(`/BillingReports/DepartmentSummaryReport?FromDate=${today}&ToDate=${today}&billingType=outpatient`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results && res.Results.DepartmentSummary) {
          const rows = res.Results.DepartmentSummary as any[];
          if (rows && rows.length) {
            this.todayRevenue = rows.reduce((sum, r) => {
              // Try common column names for total amount
              return sum + (r.NetTotal || r.TotalAmount || r.SubTotal || r.Amount || 0);
            }, 0);
          }
        }
      }, () => {
        // Fallback: try DepartmentRevenue
        this.dlService.Read(`/BillingReports/DepartmentRevenueReport?FromDate=${today}&ToDate=${today}`)
          .subscribe((res2: any) => {
            if (res2 && res2.Status === 'OK' && res2.Results && res2.Results.JsonData) {
              try {
                const parsed = JSON.parse(res2.Results.JsonData);
                if (parsed && parsed.length) {
                  this.todayRevenue = parsed.reduce((s, r) => s + (r.Total || r.Amount || 0), 0);
                }
              } catch (e) { }
            }
          });
      });
  }

  private loadWardSummary(fromDate: string, toDate: string) {
    this.dlService.Read(`/Reporting/AllWardCountDetail?FromDate=${fromDate}&ToDate=${toDate}`)
      .subscribe((res: any) => {
        if (res && res.Results) {
          this.wardSummary = res.Results || [];
          this.occupiedBeds = this.wardSummary.reduce((sum, w) => sum + (w.InBed || 0), 0);
        }
      });
  }

  private loadEmergencySummary(today: string) {
    this.dlService.Read(`/Reporting/ERDashboard?FromDate=${today}&ToDate=${today}`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results && res.Results.JsonData) {
          try {
            const parsed = JSON.parse(res.Results.JsonData);
            if (parsed && parsed.LabelData && parsed.LabelData.length > 0) {
              this.emergencySummary = parsed.LabelData[0];
              this.erToday = this.emergencySummary.TotalRegisteredPatients || 0;
            }
          } catch (e) { }
        }
      });
  }

  private loadPatientTrends(fromDate: string, toDate: string) {
    this.dlService.Read(`/PatientDashboard/GetPatientCountByDay?FromDate=${fromDate}&ToDate=${toDate}`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results) {
          this.safeRender(() => this.renderPatientTrendChart(res.Results || []));
        }
      });
  }

  private loadPatientDistribution(today: string) {
    this.dlService.Read(`/PatientDashboard/GetDepartmentWiseAppointment?FromDate=${today}&ToDate=${today}`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results) {
          this.safeRender(() => this.renderPatientDistributionChart(res.Results || []));
        }
      }, () => {
        // Fallback to monthly
        const monthStart = moment().startOf('month').format('YYYY-MM-DD');
        this.dlService.Read(`/PatientDashboard/GetDepartmentWiseAppointment?FromDate=${monthStart}&ToDate=${today}`)
          .subscribe((res2: any) => {
            if (res2 && res2.Status === 'OK' && res2.Results) {
              this.safeRender(() => this.renderPatientDistributionChart(res2.Results || []));
            }
          });
      });
  }

  private loadDepartmentRevenue(today: string) {
    this.dlService.Read(`/BillingReports/DepartmentSummaryReport?FromDate=${today}&ToDate=${today}&billingType=outpatient`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results && res.Results.DepartmentSummary) {
          this.safeRender(() => this.renderDeptRevenueChart(res.Results.DepartmentSummary || []));
        }
      });
  }

  private loadTopDoctors(fromDate: string, toDate: string) {
    this.dlService.Read(`/BillingReports/DoctorRevenue?FromDate=${fromDate}&ToDate=${toDate}&PerformerName=`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results) {
          const rows = res.Results as any[];
          // Aggregate by doctor name
          const doctorMap: { [key: string]: any } = {};
          rows.forEach(r => {
            const name = r.Doctor || r.DoctorName || r.PerformerName || 'Unknown';
            if (!doctorMap[name]) {
              doctorMap[name] = { DoctorName: name, DepartmentName: r.Department || r.DepartmentName || '', TotalRevenue: 0, PatientCount: 0 };
            }
            // Sum OPD + all columns that look like revenue
            const rowTotal = (r.OPD || 0) + (r.USG || 0) + (r.CT || 0) + (r.ENT || 0) + (r.DENTAL || 0) + (r.OT || 0) + (r.GSURG || 0) + (r.GYNSURG || 0) + (r.ORTHOPROCEDURES || 0);
            const patientCount = (r.OPDCOUNT || 0) + (r.USGCOUNT || 0) + (r.CTCOUNT || 0) + (r.ENTCOUNT || 0) + (r.DENTALCOUNT || 0) + (r.OTCOUNT || 0) + (r.GSURGCOUNT || 0) + (r.GYNSURGCOUNT || 0) + (r.ORTHOPROCEDURESCOUNT || 0);
            doctorMap[name].TotalRevenue += rowTotal;
            doctorMap[name].PatientCount += patientCount;
          });

          this.topDoctors = Object.values(doctorMap)
            .filter(d => d.TotalRevenue > 0)
            .sort((a, b) => b.TotalRevenue - a.TotalRevenue)
            .slice(0, 8);
        }
      });
  }

  private loadLabTrending(fromDate: string, toDate: string) {
    this.dlService.Read(`/Reporting/LabDashboardTrendingTestCount?FromDate=${fromDate}&Todate=${toDate}`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results) {
          this.safeRender(() => this.renderLabTrendChart(res.Results || []));
        }
      });
  }

  private loadDeptAppointments(fromDate: string, toDate: string) {
    this.dlService.Read(`/PatientDashboard/GetDepartmentWiseAppointment?FromDate=${fromDate}&ToDate=${toDate}`)
      .subscribe((res: any) => {
        if (res && res.Status === 'OK' && res.Results) {
          this.safeRender(() => this.renderDeptAppointmentChart(res.Results || []));
        }
      });
  }

  // ========== CHART RENDERERS ==========

  private renderPatientTrendChart(data: any[]) {
    // Aggregate by month
    const monthMap: { [key: string]: { inpatient: number; outpatient: number } } = {};
    data.forEach(d => {
      const label = d.Label || '';
      // Try to parse the date and get YYYY-MM
      let monthKey = '';
      const parsed = moment(label, ['YYYY-MM-DD', 'DD-MM-YYYY', 'MMM DD', moment.ISO_8601], true);
      if (parsed.isValid()) {
        monthKey = parsed.format('MMM YY');
      } else {
        monthKey = label.substring(0, 7);
      }

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { inpatient: 0, outpatient: 0 };
      }
      const vt = (d.VisitType || '').toLowerCase();
      if (vt === 'inpatient') {
        monthMap[monthKey].inpatient += d.PatientCount || 0;
      } else {
        monthMap[monthKey].outpatient += d.PatientCount || 0;
      }
    });

    const months = Object.keys(monthMap);
    if (this.patientTrendChart) { this.patientTrendChart.destroy(); }
    const ctx = document.getElementById('patientTrendChart') as any;
    if (!ctx) return;

    this.patientTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Outpatient',
            data: months.map(m => monthMap[m].outpatient),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#3b82f6'
          },
          {
            label: 'Inpatient',
            data: months.map(m => monthMap[m].inpatient),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#22c55e'
          }
        ]
      },
      options: this.lineChartOptions()
    });
  }

  private renderPatientDistributionChart(data: any[]) {
    const filtered = (data || []).filter(d => d.AppointmentCount > 0).slice(0, 10);
    if (this.patientDistributionChart) { this.patientDistributionChart.destroy(); }
    const ctx = document.getElementById('patientDistributionChart') as any;
    if (!ctx) return;

    this.patientDistributionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: filtered.map(d => d.DepartmentName),
        datasets: [{
          data: filtered.map(d => d.AppointmentCount),
          backgroundColor: this.getColors(filtered.length),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        maintainAspectRatio: false,
        legend: {
          display: true,
          position: 'right',
          labels: { usePointStyle: true, boxWidth: 8, fontSize: 11 }
        },
        cutoutPercentage: 65
      }
    });
  }

  private renderDeptRevenueChart(data: any[]) {
    // Get top 8 departments by revenue
    const sorted = [...data]
      .map(d => ({
        name: d.ServiceDepartmentName || d.DepartmentName || d.Department || 'Other',
        total: d.NetTotal || d.TotalAmount || d.SubTotal || d.Amount || 0
      }))
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    if (this.deptRevenueChart) { this.deptRevenueChart.destroy(); }
    const ctx = document.getElementById('deptRevenueChart') as any;
    if (!ctx) return;

    this.deptRevenueChart = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: sorted.map(d => d.name),
        datasets: [{
          label: 'Revenue',
          data: sorted.map(d => d.total),
          backgroundColor: this.getColors(sorted.length),
          borderRadius: 6
        }]
      },
      options: {
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          xAxes: [{
            gridLines: { display: false },
            ticks: {
              beginAtZero: true,
              callback: (value: number) => {
                if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
                return value;
              }
            }
          }],
          yAxes: [{
            gridLines: { display: false },
            barThickness: 22
          }]
        }
      }
    });
  }

  private renderDeptAppointmentChart(data: any[]) {
    const filtered = (data || []).filter(d => d.AppointmentCount > 0).slice(0, 10);
    if (this.deptAppointmentChart) { this.deptAppointmentChart.destroy(); }
    const ctx = document.getElementById('deptAppointmentChart') as any;
    if (!ctx) return;

    this.deptAppointmentChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: filtered.map(d => d.DepartmentName),
        datasets: [{
          label: 'Appointments',
          data: filtered.map(d => d.AppointmentCount),
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: {
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          xAxes: [{ gridLines: { display: false } }],
          yAxes: [{ gridLines: { display: false }, ticks: { beginAtZero: true } }]
        }
      }
    });
  }

  private renderLabTrendChart(data: any[]) {
    const filtered = (data || []).filter(d => d.Counts > 0).slice(0, 10);
    if (this.labTrendChart) { this.labTrendChart.destroy(); }
    const ctx = document.getElementById('labTrendChart') as any;
    if (!ctx) return;

    this.labTrendChart = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: filtered.map(d => d.LabTestName),
        datasets: [{
          label: 'Tests',
          data: filtered.map(d => d.Counts),
          backgroundColor: '#14b8a6',
          borderRadius: 6
        }]
      },
      options: {
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          xAxes: [{ gridLines: { display: false }, ticks: { beginAtZero: true } }],
          yAxes: [{ gridLines: { display: false }, barThickness: 20 }]
        }
      }
    });
  }

  // ========== HELPERS ==========

  private lineChartOptions() {
    return {
      maintainAspectRatio: false,
      legend: {
        display: true,
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 8, fontSize: 12 }
      },
      scales: {
        xAxes: [{ gridLines: { display: false } }],
        yAxes: [{
          gridLines: { color: 'rgba(0,0,0,0.04)' },
          ticks: { beginAtZero: true }
        }]
      }
    };
  }

  private getColors(count: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.colors[i % this.colors.length]);
    }
    return result;
  }

  private safeRender(callback: Function) {
    setTimeout(() => {
      try {
        this.changeDetector.detectChanges();
        callback();
      } catch (ex) {
        console.warn('Dashboard chart render:', ex);
      }
    }, 100);
  }

  private destroyAllCharts() {
    [this.patientTrendChart, this.patientDistributionChart, this.deptRevenueChart, this.deptAppointmentChart, this.labTrendChart].forEach(c => {
      if (c) { try { c.destroy(); } catch (e) { } }
    });
  }
}
