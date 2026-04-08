module.exports = {
    // ── Schemas ───────────────────────────────────────────────────────
    schemas: {
        RoleResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 3 },
                company_id: { type: 'integer', example: 1 },
                name: { type: 'string', example: 'Digital Marketer' },
                description: { type: 'string', example: 'Handles marketing tasks', nullable: true },
                permissions: { type: 'object', description: 'Page-level permission map' },
                sub_account_linking_status: { type: 'string', enum: ['linked', 'not_linked'], example: 'linked' },
                user_count: { type: 'integer', example: 3, description: 'Number of sub accounts using this role' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
            },
        },

        CreateRoleRequest: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', minLength: 2, maxLength: 100, example: 'Digital Marketer' },
                description: { type: 'string', maxLength: 500, example: 'Handles all marketing tasks' },
                subAccountLinkingStatus: { type: 'string', enum: ['linked', 'not_linked'], example: 'not_linked' },
                permissions: {
                    type: 'object',
                    description: 'Hierarchical page-level access map supporting 3 levels of depth.',
                    example: {
                        dashboard: { access: true },
                        product_management: {
                            access: true,
                            sub: { product_list: true, combine_sku: true }
                        },
                        inventory_management: {
                            access: true,
                            sub: {
                                inventory_list: true,
                                inbound: {
                                    access: true,
                                    sub: { inbound_draft: true, inbound_on_the_way: true, inbound_complete: true }
                                }
                            }
                        },
                        order_management: {
                            access: true,
                            sub: {
                                order_processing: {
                                    access: true,
                                    sub: { new_order: true, processed_order: true, shipped_order: false, completed_order: false, all_order: false, canceled_order: false }
                                },
                                manual_order: true
                            }
                        },
                        warehouse_management: { access: false },
                        system_configuration: {
                            access: true,
                            sub: {
                                store_authorization: false,
                                account_management: {
                                    access: true,
                                    sub: { sub_account: true, role_management: true }
                                }
                            }
                        }
                    },
                    properties: {
                        dashboard: {
                            type: 'object',
                            properties: { access: { type: 'boolean' } }
                        },
                        product_management: {
                            type: 'object',
                            properties: {
                                access: { type: 'boolean' },
                                sub: {
                                    type: 'object',
                                    properties: {
                                        product_list: { type: 'boolean' },
                                        combine_sku: { type: 'boolean' }
                                    }
                                }
                            }
                        },
                        inventory_management: {
                            type: 'object',
                            properties: {
                                access: { type: 'boolean' },
                                sub: {
                                    type: 'object',
                                    properties: {
                                        inventory_list: { type: 'boolean' },
                                        inbound: {
                                            type: 'object',
                                            properties: {
                                                access: { type: 'boolean' },
                                                sub: {
                                                    type: 'object',
                                                    properties: {
                                                        inbound_draft: { type: 'boolean' },
                                                        inbound_on_the_way: { type: 'boolean' },
                                                        inbound_complete: { type: 'boolean' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        order_management: {
                            type: 'object',
                            properties: {
                                access: { type: 'boolean' },
                                sub: {
                                    type: 'object',
                                    properties: {
                                        order_processing: {
                                            type: 'object',
                                            properties: {
                                                access: { type: 'boolean' },
                                                sub: {
                                                    type: 'object',
                                                    properties: {
                                                        new_order: { type: 'boolean' },
                                                        processed_order: { type: 'boolean' },
                                                        shipped_order: { type: 'boolean' },
                                                        completed_order: { type: 'boolean' },
                                                        all_order: { type: 'boolean' },
                                                        canceled_order: { type: 'boolean' }
                                                    }
                                                }
                                            }
                                        },
                                        manual_order: { type: 'boolean' }
                                    }
                                }
                            }
                        },
                        warehouse_management: {
                            type: 'object',
                            properties: { access: { type: 'boolean' } }
                        },
                        system_configuration: {
                            type: 'object',
                            properties: {
                                access: { type: 'boolean' },
                                sub: {
                                    type: 'object',
                                    properties: {
                                        store_authorization: { type: 'boolean' },
                                        account_management: {
                                            type: 'object',
                                            properties: {
                                                access: { type: 'boolean' },
                                                sub: {
                                                    type: 'object',
                                                    properties: {
                                                        sub_account: { type: 'boolean' },
                                                        role_management: { type: 'boolean' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
        },

        PermissionTemplateResponse: {
            type: 'object',
            properties: {
                pages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            key: { type: 'string', example: 'product_management' },
                            label: { type: 'string', example: 'Product Management' },
                            hasSub: { type: 'boolean', example: true },
                            sub: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        key: { type: 'string', example: 'merchant_sku' },
                                        label: { type: 'string', example: 'Merchant SKU' },
                                    },
                                },
                            },
                        },
                    },
                },
                defaultPermissions: { type: 'object' },
            },
        },
    },

    // ── Paths ─────────────────────────────────────────────────────────
    paths: {
        '/roles/permissions/template': {
            get: {
                tags: ['Roles'],
                summary: 'Get permission template — all pages and sub-pages',
                description: 'Returns the full permission structure the frontend uses to render the Add/Edit Role checkbox UI.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Permission template', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/PermissionTemplateResponse' } } } } } },
                    401: { description: 'Unauthorized' },
                },
            },
        },

        '/roles': {
            get: {
                tags: ['Roles'],
                summary: 'Get all roles for the company (paginated)',
                description: 'Includes user_count per role. Supports search and filter by linking status.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 }, description: 'Items per page' },
                    { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by name or description' },
                    { in: 'query', name: 'subAccountLinkingStatus', schema: { type: 'string', enum: ['linked', 'not_linked'] }, description: 'Filter by linking status' },
                ],
                responses: {
                    200: { description: 'Roles list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/RoleResponse' } }, pagination: { type: 'object' } } } } } },
                    401: { description: 'Unauthorized' },
                },
            },
            post: {
                tags: ['Roles'],
                summary: 'Create a new role — owner/admin only',
                description: 'Permissions default to false for any page not specified. Owner role is auto-created on registration and cannot be duplicated.',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRoleRequest' } } } },
                responses: {
                    201: { description: 'Role created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RoleResponse' } } } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    403: { description: 'Permission denied' },
                    409: { description: 'Role name already exists' },
                },
            },
        },

        '/roles/{id}': {
            get: {
                tags: ['Roles'],
                summary: 'Get a specific role by ID',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 3 } }],
                responses: {
                    200: { description: 'Role details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RoleResponse' } } } } } },
                    404: { description: 'Role not found' },
                },
            },
            put: {
                tags: ['Roles'],
                summary: 'Update a role — owner/admin only',
                description: 'Updates name, description, permissions, and/or linking status. Owner role cannot be modified.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 3 } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    subAccountLinkingStatus: { type: 'string', enum: ['linked', 'not_linked'] },
                                    permissions: {
                                        type: 'object',
                                        description: 'Hierarchical page-level access map supporting 3 levels of depth.',
                                        example: {
                                            dashboard: { access: true },
                                            product_management: {
                                                access: true,
                                                sub: { product_list: true, combine_sku: true }
                                            },
                                            inventory_management: {
                                                access: true,
                                                sub: {
                                                    inventory_list: true,
                                                    inbound: {
                                                        access: true,
                                                        sub: { inbound_draft: true, inbound_on_the_way: true, inbound_complete: true }
                                                    }
                                                }
                                            },
                                            order_management: {
                                                access: true,
                                                sub: {
                                                    order_processing: {
                                                        access: true,
                                                        sub: { new_order: true, processed_order: true, shipped_order: false, completed_order: false, all_order: false, canceled_order: false }
                                                    },
                                                    manual_order: true
                                                }
                                            },
                                            warehouse_management: { access: false },
                                            system_configuration: {
                                                access: true,
                                                sub: {
                                                    store_authorization: false,
                                                    account_management: {
                                                        access: true,
                                                        sub: { sub_account: true, role_management: true }
                                                    }
                                                }
                                            }
                                        },
                                        properties: {
                                            dashboard: {
                                                type: 'object',
                                                properties: { access: { type: 'boolean' } }
                                            },
                                            product_management: {
                                                type: 'object',
                                                properties: {
                                                    access: { type: 'boolean' },
                                                    sub: {
                                                        type: 'object',
                                                        properties: {
                                                            product_list: { type: 'boolean' },
                                                            combine_sku: { type: 'boolean' }
                                                        }
                                                    }
                                                }
                                            },
                                            inventory_management: {
                                                type: 'object',
                                                properties: {
                                                    access: { type: 'boolean' },
                                                    sub: {
                                                        type: 'object',
                                                        properties: {
                                                            inventory_list: { type: 'boolean' },
                                                            inbound: {
                                                                type: 'object',
                                                                properties: {
                                                                    access: { type: 'boolean' },
                                                                    sub: {
                                                                        type: 'object',
                                                                        properties: {
                                                                            inbound_draft: { type: 'boolean' },
                                                                            inbound_on_the_way: { type: 'boolean' },
                                                                            inbound_complete: { type: 'boolean' }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            order_management: {
                                                type: 'object',
                                                properties: {
                                                    access: { type: 'boolean' },
                                                    sub: {
                                                        type: 'object',
                                                        properties: {
                                                            order_processing: {
                                                                type: 'object',
                                                                properties: {
                                                                    access: { type: 'boolean' },
                                                                    sub: {
                                                                        type: 'object',
                                                                        properties: {
                                                                            new_order: { type: 'boolean' },
                                                                            processed_order: { type: 'boolean' },
                                                                            shipped_order: { type: 'boolean' },
                                                                            completed_order: { type: 'boolean' },
                                                                            all_order: { type: 'boolean' },
                                                                            canceled_order: { type: 'boolean' }
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            manual_order: { type: 'boolean' }
                                                        }
                                                    }
                                                }
                                            },
                                            warehouse_management: {
                                                type: 'object',
                                                properties: { access: { type: 'boolean' } }
                                            },
                                            system_configuration: {
                                                type: 'object',
                                                properties: {
                                                    access: { type: 'boolean' },
                                                    sub: {
                                                        type: 'object',
                                                        properties: {
                                                            store_authorization: { type: 'boolean' },
                                                            account_management: {
                                                                type: 'object',
                                                                properties: {
                                                                    access: { type: 'boolean' },
                                                                    sub: {
                                                                        type: 'object',
                                                                        properties: {
                                                                            sub_account: { type: 'boolean' },
                                                                            role_management: { type: 'boolean' }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RoleResponse' } } } } } },
                    403: { description: 'Permission denied or Owner role' },
                    404: { description: 'Role not found' },
                    409: { description: 'Role name already exists' },
                },
            },
            delete: {
                tags: ['Roles'],
                summary: 'Delete a role — owner/admin only',
                description: 'Cannot delete Owner role or a role that has active sub accounts assigned to it.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 3 } }],
                responses: {
                    200: { description: 'Deleted successfully' },
                    400: { description: 'Role has active sub accounts — reassign first' },
                    403: { description: 'Permission denied or Owner role' },
                    404: { description: 'Role not found' },
                },
            },
        },

        '/roles/{id}/permissions': {
            patch: {
                tags: ['Roles'],
                summary: 'Update role permissions only — owner/admin only',
                description: 'Replaces the full permissions map. Use this for the checkbox UI Save action.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 3 } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['permissions'],
                                properties: {
                                    permissions: {
                                        type: 'object',
                                        example: {
                                            dashboard: { access: true },
                                            product_management: { access: true, sub: { merchant_sku: true, combine_sku: true, sku_mapping: false } },
                                            inventory_management: { access: true, sub: { inventory_list: true, inbound: true } },
                                            order_management: { access: false },
                                            warehouse_management: { access: false },
                                            system_configuration: { access: false },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Permissions updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RoleResponse' } } } } } },
                    403: { description: 'Permission denied or Owner role' },
                    404: { description: 'Role not found' },
                },
            },
        },
    },
};