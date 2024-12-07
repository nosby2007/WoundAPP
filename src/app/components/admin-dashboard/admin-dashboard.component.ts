import { Component, AfterViewInit, ViewChild, ElementRef, OnInit } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';


@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements AfterViewInit {
  title = 'Tableau de bord Admin';
  @ViewChild('barChart') barChartRef!: ElementRef;

  constructor() {Chart.register(...registerables);}

  ngAfterViewInit(): void {
    this.initializeBarChart();
  }
  private initializeBarChart(): void {
    const barChartConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        datasets: [
          {
            label: 'Nouveaux Utilisateurs',
            data: [12, 19, 3, 5, 2],
            backgroundColor: [
              'rgba(75, 192, 192, 0.2)',
              'rgba(54, 162, 235, 0.2)',
              'rgba(255, 206, 86, 0.2)',
              'rgba(231, 233, 237, 0.2)',
              'rgba(255, 159, 64, 0.2)',
            ],
            borderColor: [
              'rgba(75, 192, 192, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(231, 233, 237, 1)',
              'rgba(255, 159, 64, 1)',
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
        },
      },
    };

    new Chart(this.barChartRef.nativeElement, barChartConfig);
  }
}