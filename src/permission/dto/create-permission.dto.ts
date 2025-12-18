import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsArray,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';

const validActions = ['create', 'read', 'update', 'delete'] as const;
type Action = (typeof validActions)[number];

export class CreatePermissionDto {
  @IsIn(['basic', 'crud'], {
    message: 'permission_type must be either "basic" or "crud"',
  })
  permission_type: string;

  @ValidateIf((o: CreatePermissionDto) => o.permission_type === 'basic')
  @IsString()
  @IsNotEmpty()
  display_name?: string;

  @ValidateIf((o: CreatePermissionDto) => o.permission_type === 'basic')
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ValidateIf((o: CreatePermissionDto) => o.permission_type === 'crud')
  @IsString()
  @IsNotEmpty()
  resource?: string;

  @ValidateIf((o: CreatePermissionDto) => o.permission_type === 'crud')
  @IsArray()
  @ArrayMinSize(1, {
    message: 'action array must contain at least one element',
  })
  @IsIn(validActions, {
    each: true,
    message: 'action must be one of "create", "read", "update", or "delete"',
  })
  action?: Action[];
}