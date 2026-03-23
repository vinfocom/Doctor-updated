import prisma from "@/lib/prisma";
import {
  formatDateToISTYMD,
  formatUTCDateToISTTime,
  getISTDayOfWeek,
} from "@/lib/appointmentDateTime";

type AppointmentLike = {
  appointment_id: number;
  doctor_id?: number | null;
  clinic_id?: number | null;
  appointment_date?: Date | string | null;
  start_time?: Date | string | null;
  booking_id?: number | null;
};

type ScheduleLike = {
  doctor_id?: number | null;
  clinic_id?: number | null;
  day_of_week: number;
  effective_from: Date;
  effective_to: Date;
  start_time?: string | null;
  end_time?: string | null;
  slot_duration?: number | null;
};

const normalizeScheduleTime = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const amPmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]) % 12;
    const minutes = Number(amPmMatch[2]);
    if (amPmMatch[3].toUpperCase() === "PM") hours += 12;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return raw.slice(0, 5);
};

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const getScheduleKeyForAppointment = (
  appointment: AppointmentLike,
  schedules: ScheduleLike[]
) => {
  if (!appointment.doctor_id || !appointment.clinic_id || !appointment.appointment_date || !appointment.start_time) {
    return null;
  }

  const dateYmd = formatDateToISTYMD(appointment.appointment_date);
  const startHm = formatUTCDateToISTTime(appointment.start_time);
  if (!dateYmd || !startHm) return null;

  const dayOfWeek = getISTDayOfWeek(dateYmd);
  const slotMinutes = timeToMinutes(startHm);

  const matchingSchedules = schedules.filter((schedule) => {
    if (schedule.doctor_id !== appointment.doctor_id) return false;
    if (schedule.clinic_id !== appointment.clinic_id) return false;
    if (schedule.day_of_week !== dayOfWeek) return false;

    const effectiveFrom = formatDateToISTYMD(schedule.effective_from);
    const effectiveTo = formatDateToISTYMD(schedule.effective_to);
    if (!effectiveFrom || !effectiveTo) return false;
    if (dateYmd < effectiveFrom || dateYmd > effectiveTo) return false;

    const scheduleStart = normalizeScheduleTime(schedule.start_time);
    const scheduleEnd = normalizeScheduleTime(schedule.end_time);
    if (!scheduleStart || !scheduleEnd) return false;

    const startMinutes = timeToMinutes(scheduleStart);
    const endMinutes = timeToMinutes(scheduleEnd);
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  });

  if (matchingSchedules.length === 0) {
    return `${appointment.doctor_id}:${appointment.clinic_id}:${dateYmd}:default`;
  }

  matchingSchedules.sort((a, b) => {
    const aStart = normalizeScheduleTime(a.start_time);
    const bStart = normalizeScheduleTime(b.start_time);
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    const aEnd = normalizeScheduleTime(a.end_time);
    const bEnd = normalizeScheduleTime(b.end_time);
    return aEnd.localeCompare(bEnd);
  });

  const selected = matchingSchedules[0];
  return [
    appointment.doctor_id,
    appointment.clinic_id,
    dateYmd,
    normalizeScheduleTime(selected.start_time),
    normalizeScheduleTime(selected.end_time),
  ].join(":");
};

const getBookingIdFromSchedule = (
  appointment: AppointmentLike,
  schedules: ScheduleLike[]
) => {
  if (!appointment.appointment_date || !appointment.start_time) return null;

  const dateYmd = formatDateToISTYMD(appointment.appointment_date);
  const startHm = formatUTCDateToISTTime(appointment.start_time);
  if (!dateYmd || !startHm) return null;

  const dayOfWeek = getISTDayOfWeek(dateYmd);
  const slotMinutes = timeToMinutes(startHm);

  const matchingSchedules = schedules.filter((schedule) => {
    if (schedule.doctor_id !== appointment.doctor_id) return false;
    if (schedule.clinic_id !== appointment.clinic_id) return false;
    if (schedule.day_of_week !== dayOfWeek) return false;

    const effectiveFrom = formatDateToISTYMD(schedule.effective_from);
    const effectiveTo = formatDateToISTYMD(schedule.effective_to);
    if (!effectiveFrom || !effectiveTo) return false;
    if (dateYmd < effectiveFrom || dateYmd > effectiveTo) return false;

    const scheduleStart = normalizeScheduleTime(schedule.start_time);
    const scheduleEnd = normalizeScheduleTime(schedule.end_time);
    if (!scheduleStart || !scheduleEnd) return false;

    const startMinutes = timeToMinutes(scheduleStart);
    const endMinutes = timeToMinutes(scheduleEnd);
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  });

  if (matchingSchedules.length === 0) return null;

  matchingSchedules.sort((a, b) => {
    const aStart = normalizeScheduleTime(a.start_time);
    const bStart = normalizeScheduleTime(b.start_time);
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    const aEnd = normalizeScheduleTime(a.end_time);
    const bEnd = normalizeScheduleTime(b.end_time);
    return aEnd.localeCompare(bEnd);
  });

  const selected = matchingSchedules[0];
  const scheduleStart = normalizeScheduleTime(selected.start_time);
  const slotDuration = Number(selected.slot_duration || 0);
  if (!scheduleStart || !slotDuration) return null;

  const startMinutes = timeToMinutes(scheduleStart);
  const diff = slotMinutes - startMinutes;
  if (diff < 0) return null;

  return Math.floor(diff / slotDuration) + 1;
};

export async function computeBookingIdForAppointment(input: {
  doctor_id?: number | null;
  clinic_id?: number | null;
  appointment_date?: Date | string | null;
  start_time?: Date | string | null;
}): Promise<number | null> {
  const { doctor_id, clinic_id, appointment_date, start_time } = input;
  if (!doctor_id || !clinic_id || !appointment_date || !start_time) return null;

  const dateYmd = formatDateToISTYMD(appointment_date);
  const startHm = formatUTCDateToISTTime(start_time);
  if (!dateYmd || !startHm) return null;

  const dayOfWeek = getISTDayOfWeek(dateYmd);

  const schedules = await prisma.doctor_clinic_schedule.findMany({
    where: {
      doctor_id,
      clinic_id,
      day_of_week: dayOfWeek,
      effective_from: { lte: new Date(`${dateYmd}T00:00:00.000Z`) },
      effective_to: { gte: new Date(`${dateYmd}T00:00:00.000Z`) },
    },
    select: {
      doctor_id: true,
      clinic_id: true,
      day_of_week: true,
      effective_from: true,
      effective_to: true,
      start_time: true,
      end_time: true,
      slot_duration: true,
    },
  });

  const fakeAppointment: AppointmentLike = {
    appointment_id: 0,
    doctor_id,
    clinic_id,
    appointment_date,
    start_time,
  };

  return getBookingIdFromSchedule(fakeAppointment, schedules);
}

export async function attachBookingIds<T extends AppointmentLike>(
  appointments: T[]
): Promise<Array<T & { booking_id: number | null }>> {
  if (appointments.length === 0) return [];

  const doctorIds = [...new Set(appointments.map((apt) => apt.doctor_id).filter((value): value is number => Boolean(value)))];
  const clinicIds = [...new Set(appointments.map((apt) => apt.clinic_id).filter((value): value is number => Boolean(value)))];
  const appointmentDates = appointments
    .map((apt) => (apt.appointment_date ? formatDateToISTYMD(apt.appointment_date) : ""))
    .filter(Boolean);

  if (doctorIds.length === 0 || clinicIds.length === 0 || appointmentDates.length === 0) {
    return appointments.map((apt) => ({ ...apt, booking_id: null }));
  }

  const minDate = appointmentDates.reduce((min, value) => (value < min ? value : min), appointmentDates[0]);
  const maxDate = appointmentDates.reduce((max, value) => (value > max ? value : max), appointmentDates[0]);

  const schedules = await prisma.doctor_clinic_schedule.findMany({
    where: {
      doctor_id: { in: doctorIds },
      clinic_id: { in: clinicIds },
      effective_from: { lte: new Date(`${maxDate}T00:00:00.000Z`) },
      effective_to: { gte: new Date(`${minDate}T00:00:00.000Z`) },
    },
    select: {
      doctor_id: true,
      clinic_id: true,
      day_of_week: true,
      effective_from: true,
      effective_to: true,
      start_time: true,
      end_time: true,
      slot_duration: true,
    },
  });

  const groups = new Map<string, T[]>();
  for (const appointment of appointments) {
    const key = getScheduleKeyForAppointment(appointment, schedules);
    if (!key) continue;
    const existing = groups.get(key) || [];
    existing.push(appointment);
    groups.set(key, existing);
  }

  const bookingIdMap = new Map<number, number>();
  for (const groupAppointments of groups.values()) {
    groupAppointments.forEach((appointment) => {
      if (appointment.booking_id != null) {
        bookingIdMap.set(appointment.appointment_id, appointment.booking_id);
      }
    });

    groupAppointments.forEach((appointment) => {
      if (bookingIdMap.has(appointment.appointment_id)) return;
      const bookingId = getBookingIdFromSchedule(appointment, schedules);
      if (bookingId) {
        bookingIdMap.set(appointment.appointment_id, bookingId);
      }
    });

    groupAppointments
      .filter((appointment) => !bookingIdMap.has(appointment.appointment_id))
      .sort((a, b) => {
        const aStart = formatUTCDateToISTTime(a.start_time) || "";
        const bStart = formatUTCDateToISTTime(b.start_time) || "";
        if (aStart !== bStart) return aStart.localeCompare(bStart);
        return a.appointment_id - b.appointment_id;
      })
      .forEach((appointment, index) => {
        bookingIdMap.set(appointment.appointment_id, index + 1);
      });
  }

  return appointments.map((appointment) => ({
    ...appointment,
    booking_id: bookingIdMap.get(appointment.appointment_id) ?? null,
  }));
}
