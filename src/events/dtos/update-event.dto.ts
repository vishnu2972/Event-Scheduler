import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';

// All fields optional at the transport layer,
// but the service will merge with existing and re-validate full shape.
export class UpdateEventDto extends PartialType(CreateEventDto) {}
