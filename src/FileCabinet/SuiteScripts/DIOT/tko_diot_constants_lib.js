/**
 * @NApiVersion 2.1
 */

define([],function(){

    const FIELD_ID = {};
    
    FIELD_ID.PANTALLA = {};
    FIELD_ID.PANTALLA.GRUPO_DATOS = 'fieldgroupid_datos';
    FIELD_ID.PANTALLA.SUBSIDIARIA = 'custpage_subsi';
    FIELD_ID.PANTALLA.PERIODO = 'custpage_period';

    const RECORD_INFO = {};

    RECORD_INFO.SUBSIDIARY_RECORD = {};
    RECORD_INFO.SUBSIDIARY_RECORD.ID = 'subsidiary';

    RECORD_INFO.ACCOUNTINGPERIOD_RECORD = {};


    return {
        FIELD_ID: FIELD_ID,
        RECORD_INFO: RECORD_INFO
    }
});