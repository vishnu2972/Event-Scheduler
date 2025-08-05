"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const isBetween_1 = __importDefault(require("dayjs/plugin/isBetween"));
const file_storage_1 = require("./utils/file-storage");
dayjs_1.default.extend(isBetween_1.default);
let EventsService = class EventsService {
    constructor() {
        this.events = (0, file_storage_1.readEvents)();
    }
    createEvent(dto) {
        const { title, startTime, endTime, recurrence, reminderMinutes } = dto;
        const start = (0, dayjs_1.default)(startTime);
        const end = (0, dayjs_1.default)(endTime);
        if (!start.isBefore(end)) {
            throw new common_1.BadRequestException('Start time must be before end time');
        }
        if (reminderMinutes && start.subtract(reminderMinutes, 'minute').isAfter(start)) {
            throw new common_1.BadRequestException('Reminder must be before event start time');
        }
        for (const event of this.events) {
            const conflict = this.hasConflict(start, end, event);
            if (conflict) {
                throw new common_1.BadRequestException(`Time conflict with existing event: ${event.title}`);
            }
        }
        const newEvent = {
            id: (0, uuid_1.v4)(),
            title,
            startTime,
            endTime,
            recurrence,
            reminderMinutes,
        };
        this.events.push(newEvent);
        (0, file_storage_1.writeEvents)(this.events);
        return newEvent;
    }
    getTodaysEvents() {
        const today = (0, dayjs_1.default)().startOf('day');
        const tomorrow = today.add(1, 'day');
        return this.events.filter((event) => {
            const start = (0, dayjs_1.default)(event.startTime);
            if (event.recurrence === 'none') {
                return start.isAfter(today) && start.isBefore(tomorrow);
            }
            else if (event.recurrence === 'daily') {
                return true;
            }
            else if (event.recurrence === 'weekly') {
                return start.day() === today.day();
            }
        });
    }
    hasConflict(newStart, newEnd, existing) {
        const existingStart = (0, dayjs_1.default)(existing.startTime);
        const existingEnd = (0, dayjs_1.default)(existing.endTime);
        if (existing.recurrence === 'none') {
            return newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart);
        }
        const now = (0, dayjs_1.default)();
        const checkDays = existing.recurrence === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [existingStart.day()];
        return checkDays.includes(now.day()) &&
            newStart.format('HH:mm') < existingEnd.format('HH:mm') &&
            newEnd.format('HH:mm') > existingStart.format('HH:mm');
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)()
], EventsService);
