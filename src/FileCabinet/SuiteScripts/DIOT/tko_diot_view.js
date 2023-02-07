/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/search', 'N/task', 'N/runtime'],
    /**
 * @param{log} log
 * @param{serverWidget} serverWidget
 */
    (log, serverWidget, search, task, runtime) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var request = scriptContext.request, params = request.params, response = scriptContext.response
            try {
                let form = createUI(params);
                response.writePage({
                    pageObject: form
                });
            } catch (onRequestError) {
                log.error({ title: 'Error en onRequest', details: onRequestError })
            }
        }

        function createUI(params) {
            let form = serverWidget.createForm({
                title: 'Reporte DIOT'
            });
            form.clientScriptModulePath = './tko_diot_cs.js'

            try {
                /**
                 * *Creacion de los campos para los filtro de la DIOT
                 */

                form.addSubmitButton({
                    label: 'Generar',
                    functionName: 'generarReporte'
                });

                form.addButton({
                    id: "refresh",
                    label: "Actualizar",
                    functionName: "actualizarPantalla"
                });

                /**
                 * *Debe llenarse con las subsidiarias
                 */
                var subsidiaryList = form.addField({
                    id: "custpage_subsi",
                    type: serverWidget.FieldType.SELECT,
                    label: 'Subsidiaria'
                });

                var subsis = searchSubsidiaries();
                for (let sub = 0; sub < subsis.length; sub++) {

                    subsidiaryList.addSelectOption({
                        value: subsis[sub].id,
                        text: subsis[sub].name
                    });
                }

                /**
                 * *Debe llenarse con loa periodos contables
                 */
                var accPeriod = form.addField({
                    id: "custpage_periodo",
                    type: serverWidget.FieldType.SELECT,
                    label: 'Periodo'
                });

                var periods = searchAccountingPeriod();
                for (let period = 0; period < periods.length; period++) {
                    accPeriod.addSelectOption({
                        value: periods[period].id,
                        text: periods[period].name
                    })
                }

                /**
                 * Campo a llenar con el tipo de operación
                 */
                var operacionesList = form.addField({
                    id: 'custpage_operaciones',
                    type: serverWidget.FieldType.SELECT,
                    label: "Tipo de Operación"
                });

                var operaciones = searchOperationTypes();
                for (let operacion = 0; operacion < operaciones.length; operacion++) {
                    operacionesList.addSelectOption({
                        value: operaciones[operacion].id,
                        text: operaciones[operacion].name
                    })
                }

                var facturas = searchVendorBill();
                //log.debug({ title: 'facturas', details: facturas });

                var date = obtenerFecha();
                log.debug({ title: 'fecha', details: date });

                /**
                 * Obtener el tipo de tercero y RFC
                 */

                /* var userVendor = runtime.getCurrentUser().id;
                log.debug({ title: 'proveedor', details: userVendor}); */

                var userVendor = 2370;

                var proveedor = search.lookupFields({
                    type: search.Type.VENDOR,
                    id: userVendor,
                    columns: ['custentity_tko_diot_prov_type', 'custentity_mx_rfc', 'vatregnumber']
                })

                log.debug({ title: 'tercero', details: proveedor.custentity_tko_diot_prov_type});
                log.debug({ title: 'rfc', details: proveedor.custentity_mx_rfc});
                log.debug({ title: 'rfc legacy', details: proveedor.vatregnumber});

                /**
                 * Campo de RFC
                 */
                var campoRfc = form.addField({
                    id: 'custpage_rfc',
                    type: serverWidget.FieldType.TEXT,
                    label: 'RFC'
                });

                /**
                * Campo de nombre del extranjero
                */
                var nombreExtranjero = form.addField({
                    id: 'custpage_nombre_extranjero',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Nombre del extranjero'
                });
                nombreExtranjero.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                /**
                 * Campo de país de residencia
                 */
                var paisResidencia = form.addField({
                    id: 'custpage_pais_residencia',
                    type: serverWidget.FieldType.SELECT,
                    label: 'País de Residencia'
                });
                paisResidencia.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                if (proveedor.custentity_tko_diot_prov_type[0].value == 1) { // nacionales
                    campoRfc.isMandatory = true;
                    campoRfc.maxLength = 13;
                } else if (proveedor.custentity_tko_diot_prov_type[0].value == 2) { // extranjeros
                    campoRfc.isMandatory = false;
                    campoRfc.defaultValue = proveedor.custentity_mx_rfc;

                    nombreExtranjero.updateDisplayType({ displayType: serverWidget.FieldDisplayType.NORMAL });
                    //nombreExtranjero.defaultValue = '';
                    nombreExtranjero.isMandatory = false;

                    log.debug({ title: 'tipoDato', details: typeof nombreExtranjero });
                    log.debug({ title: 'longitudObjeto', details: Object.keys(nombreExtranjero).length });
                    log.debug({ title: 'objeto', details: JSON.stringify(nombreExtranjero) });

                    if (Object.keys(nombreExtranjero).length !== 0){
                        //paisResidencia.updateDisplayType({ displayType: serverWidget.FieldDisplayType.NORMAL });
                        paisResidencia.isMandatory = true;
                    }
                } else if (proveedor.custentity_tko_diot_prov_type[0].value == 3) { // globales
                    campoRfc.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                    campoRfc.defaultValue = '';
                } else {
                    
                }

                /**
                 * !Aqui se realizaran las actualizaciones de los stages del MR
                 */
                var sublist = form.addSublist({
                    id: 'sublistid',
                    type: serverWidget.SublistType.LIST,
                    label: 'Status progress'
                });

                var archivo = sublist.addField({
                    id: 'txt',
                    label: 'Archivo TXT',
                    type: serverWidget.FieldType.TEXT,  //se cambio RICHTEXT por TEXT 
                });

            } catch (UIError) {
                log.error({ title: 'Error en createUI', details: UIError })
            }
            return form;
        }

        /**
         * Funcion para obtener la fecha con el formato correcto
         */
        function obtenerFecha() {
            var fecha = new Date();
            var day = fecha.getDate();
            var month = fecha.getMonth() + 1;
            var year = fecha.getFullYear();

            var date = day + '/' + month + '/' + year;

            return date;
        }

        function searchSubsidiaries() {
            try {
                var subsidiaries = []
                var subsiSearch = search.create({
                    type: "subsidiary",
                    filters:
                        [
                            ["isinactive", "is", "F"]
                        ],
                    columns:
                        [
                            "internalid",
                            "name",
                            "city",
                            "state",
                            "country",
                            "currency",
                            "custrecord_company_uen",
                            "custrecord_company_brn"
                        ]
                });
                var searchResultCount = subsiSearch.runPaged().count;
                log.debug("subsidiarySearchObj result count", searchResultCount);
                subsiSearch.run().each(function (result) {
                    var id = result.getValue({ name: 'internalid' });
                    var name = result.getValue({ name: 'name' });
                    var city = result.getValue({ name: 'city' });

                    subsidiaries.push({
                        id: id,
                        name: name,
                        city: city
                    });
                    return true;
                });
            } catch (searchError) {
                log.error({ title: 'Error on searchSubsidiaries', details: searchError })
            }
            return subsidiaries
        }

        function searchAccountingPeriod() {
            try {
                var periods = []
                var aPeriod = search.create({
                    type: "accountingperiod",
                    filters:
                        [
                            ["isinactive", "is", "F"]
                        ],
                    columns:
                        [
                            "periodname",
                            search.createColumn({
                                name: "internalid",
                                sort: search.Sort.ASC
                            })
                            // "internalid"
                        ]
                });
                var searchResultCount = aPeriod.runPaged().count;
                log.debug("accountingperiodSearchObj result count", searchResultCount);
                aPeriod.run().each(function (result) {
                    var id = result.getValue({ name: 'internalid' });
                    var name = result.getValue({ name: 'periodname' });

                    periods.push({
                        id: id,
                        name: name
                    })
                    return true;
                });
            } catch (error) {
                log.error({ title: 'Error on searchAccountingPeriod', details: error })
            }
            return periods
        }

        /**
         * Funcion para obtener el tipo de operaciones
         */
        function searchOperationTypes() {
            try {
                var operaciones = []
                var tipoOp = search.create({
                    type: 'customrecord_tko_tipo_operacion',
                    filters: 
                    [
                        ["isinactive", "is", "F"]
                    ],
                    columns:
                    [
                        "internalid", "name"
                    ]
                });
                var searchResultCount = tipoOp.runPaged().count;
                log.debug("operationTypesSearchObj result count", searchResultCount);
                tipoOp.run().each(function (result) {
                    var id = result.getValue({ name: 'internalid' });
                    var name = result.getValue({ name: 'name' });

                    operaciones.push({
                        id: id,
                        name: name
                    })
                    return true;
                });
            } catch (error) {
                log.error({ title: 'Error on searchOperationTypes', details: error })
            }
            return operaciones;
        }

        /**
         * Funcion para obtener todas las facturas del proveedor
         */
        function searchVendorBill(){
            try {
                var facturas = []
                var facturaSearch = search.create({
                    type: "vendorbill",
                    filters:
                    [
                       ["type","anyof","VendBill"], 
                       "AND", 
                       ["voided","is","F"], 
                       "AND", 
                       ["mainline","is","T"]
                    ],
                    columns:
                    [
                        "internalid",
                        search.createColumn({
                            name: "ordertype",
                            sort: search.Sort.ASC
                        }),
                       "trandate",
                       "taxperiod",
                       "type",
                       "tranid",
                       "entity",
                       "account",
                       "memo",
                       "amount"
                    ]
                });
                var searchResultCount = facturaSearch.runPaged().count;
                log.debug("vendorbillSearchObj result count",searchResultCount);
                facturaSearch.run().each(function(result){
                    // .run().each has a limit of 4,000 results
                    var id = result.getValue({ name: 'internalid' });
                    var orderType = result.getValue({ name: 'ordertype' });
                    var tranDate = result.getValue({ name: 'trandate' });
                    var taxPeriod = result.getValue({ name: 'taxperiod' });
                    var type = result.getValue({ name: 'type' });
                    var tranId = result.getValue({ name: 'tranid' });
                    var entity = result.getValue({ name: 'entity' });
                    var account = result.getValue({ name: 'account' });
                    var memo = result.getValue({ name: 'memo' });
                    var amount = result.getValue({ name: 'amount' });

                    facturas.push({
                        id: id,
                        orderType, orderType,
                        tranDate: tranDate,
                        taxPeriod: taxPeriod,
                        type: type,
                        tranId: tranId,
                        entity: entity,
                        account: account,
                        memo: memo,
                        amount: amount
                    })
                    return true;
                });
            } catch (error) {
                log.error({ title: 'Error on searchVendorInvoices', details: error })
            }
            return facturas;
        }

        /**
         * Funcion para obtener los informe de gastos
         */
/*         function searchExpenseReport(){
            try{
                var informes = []
                var informesGastos = search.create({
                    type: '',
                    filters: 
                    [
                        []
                    ]
                });
            } catch (error) {
                log.error({ title: 'Error on searchExpenseReport', details: error })
            }
            return informes;
        } */

        function generaDIOT() {
            var objTransacciones = {
                "custscript_tko_diot_subsidiary": '',
                "custscript_tko_diot_periodo": '',
            }
            for (var i = 1; i <= 10; i++) {
                var scriptdeploy_id = 'customdeploy_tko_diot_generate_' + i;
                log.debug('scriptdeploy_id', scriptdeploy_id);

                var mrTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
                mrTask.scriptId = 'customscript_tko_generate_diot_mr';
                mrTask.deploymentId = scriptdeploy_id;
                mrTask.params = objTransacciones;

                try {
                    var mrTaskId = mrTask.submit();
                    log.debug("scriptTaskId tarea ejecutada", mrTaskId);
                    log.audit("Tarea ejecutada", mrTaskId);
                    break;
                }
                catch (e) {
                    log.debug({ title: "error", details: e });
                    log.error("summarize", "Aún esta corriendo el deployment: " + scriptdeploy_id);
                }
            }
        }

        return { onRequest }

    });
