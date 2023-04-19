/**
 * @NApiVersion 2.1
 */

define([],function(){

    const FIELD_ID = {};

    const INTERFACE = {};

    INTERFACE.FORM = {};
    INTERFACE.FORM.TITLE = 'Reporte DIOT';

    INTERFACE.FORM.FIELDS = {};
    INTERFACE.FORM.FIELDS.SUBSIDIARIA = {};
    INTERFACE.FORM.FIELDS.SUBSIDIARIA.ID = 'custpage_subsi';
    INTERFACE.FORM.FIELDS.SUBSIDIARIA.LABEL = 'Subsidiaria';
    INTERFACE.FORM.FIELDS.PERIODO = {};
    INTERFACE.FORM.FIELDS.PERIODO.ID = 'custpage_period';
    INTERFACE.FORM.FIELDS.PERIODO.LABEL = 'Periodo Contable';
    INTERFACE.FORM.FIELDS.MESSAGE = {};
    INTERFACE.FORM.FIELDS.MESSAGE.SUCCESS = {};
    INTERFACE.FORM.FIELDS.MESSAGE.SUCCESS.TITLE = 'Datos procesados';
    INTERFACE.FORM.FIELDS.MESSAGE.SUCCESS.MESSAGE = 'Se esta generando el reporte DIOT';
    INTERFACE.FORM.FIELDS.MESSAGE.ERROR = {};
    INTERFACE.FORM.FIELDS.MESSAGE.ERROR.TITLE = 'Datos incompletos';
    INTERFACE.FORM.FIELDS.MESSAGE.ERROR.MESSAGE = 'Asegurese de llenar todos los campos de la pantalla';

    INTERFACE.FORM.BUTTONS = {};
    INTERFACE.FORM.BUTTONS.GENERAR = {};
    INTERFACE.FORM.BUTTONS.GENERAR.ID = 'btn_generar_diot';
    INTERFACE.FORM.BUTTONS.GENERAR.LABEL = 'Generar';
    INTERFACE.FORM.BUTTONS.GENERAR.FUNCTION = 'generarReporte';

    INTERFACE.FORM.FIELD_GROUP = {};
    INTERFACE.FORM.FIELD_GROUP.DATOS = {};
    INTERFACE.FORM.FIELD_GROUP.DATOS.ID = 'fieldgroupid_datos';
    INTERFACE.FORM.FIELD_GROUP.DATOS.LABEL = 'Datos'

    const RECORD_INFO = {};

    RECORD_INFO.SUBSIDIARY_RECORD = {};
    RECORD_INFO.SUBSIDIARY_RECORD.ID = 'subsidiary';
    RECORD_INFO.SUBSIDIARY_RECORD.FIELDS = {};
    RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.INACTIVE = 'isinactive';
    RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.ID = 'internalid';
    RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.NAME = 'name';

    RECORD_INFO.ACCOUNTINGPERIOD_RECORD = {};
    RECORD_INFO.ACCOUNTINGPERIOD_RECORD.ID = 'accountingperiod';
    RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS = {};
    RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.INACTIVE = 'isinactive';
    RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.ID = 'internalid';
    RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.NAME = 'periodname';

    RECORD_INFO.SALES_TAX_RECORD = {};
    RECORD_INFO.SALES_TAX_RECORD.FIELDS = {};
    RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX = {};
    RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_RATE = 'custrecord_ste_taxcode_taxrate';
    RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_CODE = 'name';
    RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_TYPE = 'taxtype';
    RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY = {};
    RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_RATE = 'rate';
    RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_CODE = 'itemid';
    RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_TYPE = 'taxtype';

    RECORD_INFO.VENDOR_BILL_RECORD = {};
    RECORD_INFO.VENDOR_BILL_RECORD.ID = 'vendorbill';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS = {};
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX = {};
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.TYPE = 'type';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.VOIDED = 'voided';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.STATUS = 'status';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.PERIOD = 'postingperiod';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.SUBSIDIARY = 'subsidiary';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.TAXLINE = 'taxline';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.MAINLINE = 'mainline';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.TIPO_TERCERO = 'vendor.custentity_tko_diot_prov_type';
    RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUITETAX.TIPO_OPERACION = 'custbody_tko_tipo_operacion'; 


    RECORD_INFO.FOLDER_RECORD = {};
    RECORD_INFO.FOLDER_RECORD.ID = 'folder';
    RECORD_INFO.FOLDER_RECORD.FIELDS = {};
    RECORD_INFO.FOLDER_RECORD.FIELDS.ID = 'internalid';
    RECORD_INFO.FOLDER_RECORD.FIELDS.NAME = 'name';
    RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT = 'parent';
    RECORD_INFO.FOLDER_RECORD.FIELDS.VALUE = 'DIOT txt';

    RECORD_INFO.DIOT_RECORD = {};
    RECORD_INFO.DIOT_RECORD.ID = 'customrecord_tko_diot';
    RECORD_INFO.DIOT_RECORD.FIELDS = {};
    RECORD_INFO.DIOT_RECORD.FIELDS.ID = 'custrecord_tko_id_interno_diot';
    RECORD_INFO.DIOT_RECORD.FIELDS.SUBSIDIARY = 'custrecord_tko_subsidiaria_diot';
    RECORD_INFO.DIOT_RECORD.FIELDS.PERIOD = 'custrecord_tko_periodo_diot';
    RECORD_INFO.DIOT_RECORD.FIELDS.FOLDER_ID = 'custrecord_tko_id_carpeta_diot';
    RECORD_INFO.DIOT_RECORD.FIELDS.FILE = 'custrecord_tko_archivotxt_diot';
    RECORD_INFO.DIOT_RECORD.FIELDS.STATUS = 'custrecord_tko_estado_diot';
    RECORD_INFO.DIOT_RECORD.FIELDS.PERCENTAGE = 'custrecord_tko_porcentaje_diot';
    RECORD_INFO.DIOT_RECORD.FIELDS.ERROR = 'custrecord_tko_errores_diot';

    const STATUS_LIST_DIOT = {};

    STATUS_LIST_DIOT.PENDING = 'Pendiente..';
    STATUS_LIST_DIOT.OBTAINING_DATA = 'Obteniendo Datos...';
    STATUS_LIST_DIOT.VALIDATING_DATA = 'Validando Datos....';
    STATUS_LIST_DIOT.BUILDING = 'Construyendo DIOT....';
    STATUS_LIST_DIOT.ERROR = 'Error';
    STATUS_LIST_DIOT.COMPLETE = 'Completado';

    const SCRIPTS_INFO = {};

    SCRIPTS_INFO.MAP_REDUCE = {};
    SCRIPTS_INFO.MAP_REDUCE.SCRIPT_ID = 'customscript_tko_generate_diot_mr';
    SCRIPTS_INFO.MAP_REDUCE.DEPLOYMENT_ID = 'customdeploy_tko_diot_generate_1';
    SCRIPTS_INFO.MAP_REDUCE.PARAMETERS = {};
    SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.SUBSIDIARY = 'custscript_tko_diot_subsidiary';
    SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.PERIOD = 'custscript_tko_diot_periodo';
    SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID = 'custscript_tko_diot_record_id';
    SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.TIPO_GUARDADO = 'custscript_tko_diot_tipo_guardado';
    SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.NOMBRE_ARCHIVO = 'custscript_tko_diot_nombre_archivo';
    SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.NOTIFICAR = 'custscript_tko_diot_notificar_correo';

    SCRIPTS_INFO.SUITELET = {};
    SCRIPTS_INFO.SUITELET.SCRIPT_ID = 'customscript_tko_diot_view_sl';
    SCRIPTS_INFO.SUITELET.DEPLOYMENT_ID = 'customdeploy_tko_diot_view_sl';
    SCRIPTS_INFO.SUITELET.PARAMETERS = {};
    SCRIPTS_INFO.SUITELET.PARAMETERS.SUBSIDIARY = 'subsidiaria';
    SCRIPTS_INFO.SUITELET.PARAMETERS.PERIOD = 'periodo';

    SCRIPTS_INFO.CLIENT = {};
    SCRIPTS_INFO.CLIENT.FILE_NAME = 'tko_diot_cs.js';

    const RUNTIME = {};

    RUNTIME.FEATURES = {};
    RUNTIME.FEATURES.SUBSIDIARIES = 'subsidiaries';
    RUNTIME.FEATURES.SUITETAX = 'tax_overhauling';

    const COMPANY_INFORMATION = {};

    COMPANY_INFORMATION.FIELDS = {};
    COMPANY_INFORMATION.FIELDS.ID = 'companyname';

    return {
        INTERFACE: INTERFACE,
        RECORD_INFO: RECORD_INFO,
        STATUS_LIST_DIOT: STATUS_LIST_DIOT,
        SCRIPTS_INFO: SCRIPTS_INFO,
        RUNTIME: RUNTIME,
        COMPANY_INFORMATION: COMPANY_INFORMATION
    }
});