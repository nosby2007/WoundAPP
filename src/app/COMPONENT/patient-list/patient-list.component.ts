import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { Patient } from 'src/app/patient.model';
import { PatientService } from 'src/app/SERVICE/patient.service';

@Component({
  selector: 'app-patient-list',
  templateUrl: './patient-list.component.html',
  styleUrls: ['./patient-list.component.scss'],
})
export class PatientListComponent implements OnInit, OnDestroy {
  dataSource = new MatTableDataSource<Patient>([]);
  /** Identity first, then the two details that tell two patients apart. */
  displayedColumns: string[] = ['identity', 'dob', 'gender', 'action'];

  loading = true;
  errorMsg: string | null = null;

  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort!: MatSort;

  private sub?: Subscription;

  constructor(private patientService: PatientService) {}

  ngOnInit(): void {
    // Sort and filter by name rather than by the whole record, so typing a
    // name does not also match an address or a phone number.
    this.dataSource.filterPredicate = (patient, filter) =>
      (patient.name || '').toLowerCase().includes(filter);
    this.dataSource.sortingDataAccessor = (patient: any, column: string) =>
      column === 'identity' ? (patient.name || '').toLowerCase() : patient[column];

    this.sub = this.patientService.patient$.subscribe({
      next: (patients) => {
        this.dataSource.data = patients;
        this.loading = false;
      },
      error: (error) => {
        console.error('Patient list failed to load.', error);
        this.errorMsg =
          "La liste des patients n'a pas pu être chargée. " +
          "Vérifiez que votre compte est rattaché à une organisation.";
        this.loading = false;
      },
    });
  }

  ngAfterViewInit(): void {
    if (this.paginator && this.sort) {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Initials, as the avatar.
   *
   * There is no photo on a patient record, and inventing an image for a
   * clinical list would put a face next to a chart that is not that
   * person's. Initials say who it is without claiming anything untrue.
   */
  initials(patient: Patient): string {
    const parts = (patient?.name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  /** A stable colour per patient, so the same chart looks the same tomorrow. */
  avatarHue(patient: Patient): number {
    const source = patient?.id || patient?.name || '';
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = (hash * 31 + source.charCodeAt(i)) % 360;
    }
    return hash;
  }

  /**
   * Age from the date of birth.
   *
   * Shown beside the date because on a ward the age is what gets checked,
   * and computing it from the same field keeps the two from disagreeing.
   */
  age(patient: Patient): number | null {
    const dob = this.toDate(patient?.dob);
    if (!dob) return null;
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const monthDelta = now.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
      years -= 1;
    }
    return years >= 0 && years < 150 ? years : null;
  }

  /** Records carry the date as an ISO string, a Date, or a Firestore Timestamp. */
  toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  trackById(_index: number, patient: Patient): string {
    return patient.id || patient.name;
  }

  deletePatient(patientId: string): void {
    this.patientService.deletePatient(patientId).catch((error) => {
      console.error('Error deleting patient: ', error);
      this.errorMsg = "Ce patient n'a pas pu être supprimé.";
    });
  }
}
