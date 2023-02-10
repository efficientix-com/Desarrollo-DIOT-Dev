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

                /**
                 * Se obtienen las transacciones que incurren en la generacion de impuestos
                 */
                var facturas = searchVendorBill();
                var informes = searchExpenseReports();
                var polizas = searchDailyPolicy();

                var prov = buscaProveedores(facturas, informes, polizas);
                log.debug({ title: 'Objeto Prov', details: prov });

                //Agrupar impuestos por proveedor
                if (Object.entries(facturas).length !== 0){
                    var proveedores = buscarFacturas(facturas);
                    /* if(Object.entries(informes).length !== 0)
                        buscarInformesFaltantes(proveedores, informes);
                    buscarPolizasFaltantes(proveedores); */
                } else if (Object.entries(informes).length !== 0) {

                } else if (Object.entries(polizas).length !== 0) {

                } else {
                    alert("No tiene transacciones pagadas durante este mes");
                }

                /**
                 * Obtener el tipo de tercero y RFC
                 */

                /* log.debug({ title: 'tercero', details: proveedor.custentity_tko_diot_prov_type});
                log.debug({ title: 'rfc', details: proveedor.custentity_mx_rfc});
                log.debug({ title: 'rfc legacy', details: proveedor.vatregnumber}); */

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

                /* // Verifica que tenga un tipo de tercero
                if (Object.entries(proveedor.custentity_tko_diot_prov_type).length !== 0) {

                    //proveedores nacionales
                    if (proveedor.custentity_tko_diot_prov_type[0].value == 1) {
                        campoRfc.isMandatory = true;
                        campoRfc.maxLength = 13;

                    //proveedores extranjeros
                    } else if (proveedor.custentity_tko_diot_prov_type[0].value == 2) {
                        campoRfc.isMandatory = false;
                        campoRfc.defaultValue = proveedor.custentity_mx_rfc;
                        nombreExtranjero.updateDisplayType({ displayType: serverWidget.FieldDisplayType.NORMAL });
                        nombreExtranjero.defaultValue = '';
                        nombreExtranjero.isMandatory = false;
                        if (Object.keys(nombreExtranjero).length !== 0){
                            //paisResidencia.updateDisplayType({ displayType: serverWidget.FieldDisplayType.NORMAL });
                            paisResidencia.isMandatory = true;
                        }

                    //proveedores globales
                    } else if (proveedor.custentity_tko_diot_prov_type[0].value == 3) {
                        campoRfc.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                        campoRfc.defaultValue = '';
                    } else {
                        
                    }
                } else {

                }
 */
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
         * Funcion para buscar los proveedores de cada una de las transacciones
         * @param {*} facturas Facturas encontradas del mes pasado
         * @param {*} informes Informes encontrados del mes pasado
         * @param {*} polizas  Polizas encontradas del mes pasado
         * @returns Objeto con los proveedores de cada tipo de transacción
         */
        function buscaProveedores(facturas, informes, polizas) {
            var proveedoresFact = []
            var proveedoresInfo = []
            var proveedoresPoli = []
            if (Object.entries(facturas).length !== 0) {
                for (let factura = 0; factura < facturas.length; factura++) {
                    var userVendor = facturas[factura].entity;
                    proveedoresFact.push({
                        userVendor: userVendor
                    })
                }
            } else if (Object.entries(informes).length !== 0) {
                for (let informe = 0; informe < informes.length; informe++) {
                    var userVendor = informes[informe].entity;
                    proveedoresInfo.push({
                        userVendor: userVendor
                    })
                }
            } else if (Object.entries(polizas).length !== 0) {
                for (let poliza = 0; poliza < polizas.length; poliza++) {
                    var userVendor = polizas[poliza].entity;
                    proveedoresPoli.push({
                        userVendor: userVendor
                    })
                }
            } else {
                log.debug({ title: 'Proveedores', details: 'No se tienen transacciones del mes pasado' });
            }
            var proveedores = []
            proveedores.push({
                proveedoresFact: proveedoresFact,
                proveedoresInfo: proveedoresInfo,
                proveedoresPoli: proveedoresPoli
            })
            return proveedores;
        }

        /**
         * Funcion para buscar facturas de un proveedor
         */
        function buscarFacturas(facturas, informes, polizas) {
            var proveedores = []
            for (let factura = 0; factura < facturas.length; factura++) {
                var userVendor = facturas[factura].entity;
                var proveedor = search.lookupFields({
                    type: search.Type.VENDOR,
                    id: userVendor,
                    columns: ['custentity_tko_diot_prov_type', 'custentity_mx_rfc', 'vatregnumber']
                })
                // busca informes y polizas de ese proveedor
                var informesProv = buscarInformes(userVendor, informes);
                if (Object.entries(informesProv).length !== 0) {
                    //se escribe en el txt
                }
                var polizasProv = buscarPolizas(userVendor, polizas);
                if(Object.entries(polizasProv).length !== 0) {
                    //se escribe en el txt
                }
                proveedores.push({
                    userVendor: userVendor
                })
            }
            return proveedores;
        }

        /**
         * Funcion para buscar informes de gastos
         */
        function buscarInformes(proveedor, informes) {
            var informeProv = []
            for (let informe = 0; informe < informes.length; informe++) {
                if (informes[informe].entity === proveedor) {
                    informeProv.push({
                        informes: informes[informe]
                    })
                }
            }
            return informeProv;
        }

        function buscarInformesFaltantes(proveedores, informes) {
            var informesFaltantes = []
            for (let informe = 0; informe < informes.length; informe++) {
                for (let i = 0; i < proveedores.length; i++) {
                    if (informes[informe].entity !== proveedores[i]) {
                        var polizasProv = buscarPolizas(proveedores[i], polizas);
                        informesFaltantes.push({ 
                            informes: informes[informe],
                            polizas: polizasProv
                        })
                    }
                }
            }
            return informesFaltantes;
        }

        /**
         * Funcion para buscar polizas de un proveedor
         */
        function buscarPolizas(proveedor, polizas) {
            var polizaProv = []
            for (let poliza = 0; poliza < polizas.length; poliza++) {
                if (polizas[poliza].entity === proveedor) {
                    polizaProv.push({
                        polizas: polizas[poliza]
                    })
                }
            }
            return polizaProv;
        }

        function buscarPolizasFaltantes(proveedores, polizas) {
            var polizasFaltantes = []
            for (let poliza = 0; poliza < polizas.length; poliza++) {
                for (let i = 0; i < proveedores.length; i++) {
                    if (polizas[poliza].entity !== proveedores[i]) {
                        polizasFaltantes.push({ 
                            polizas: polizas[poliza]
                        })
                    }
                }
            }
            return polizasFaltantes;
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
         * Funcion para obtener todas las facturas pagadas de proveedores
         */
        function searchVendorBill() {
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
                       ["mainline","is","T"],
                       "AND",
                       ["status","anyof","VendBill:B"],
                       "AND", 
                       ["trandate","within","lastmonth"]
                    ],
                    columns:
                    [
                        "internalid",
                        search.createColumn({
                            name: "ordertype",
                            sort: search.Sort.ASC
                        }),
                       "trandate",
                       "postingperiod",
                       "type",
                       "tranid",
                       "entity",
                       "account",
                       "memo",
                       "amount"
                    ]
                });
                var searchResultCount = facturaSearch.runPaged().count;
                log.debug("vendorBillSearchObj result count",searchResultCount);
                facturaSearch.run().each(function(result){
                    // .run().each has a limit of 4,000 results
                    var id = result.getValue({ name: 'internalid' });
                    var tranDate = result.getValue({ name: 'trandate' });
                    var postingPeriod = result.getValue({ name: 'postingperiod' });
                    var type = result.getValue({ name: 'type' });
                    var tranId = result.getValue({ name: 'tranid' });
                    var entity = result.getValue({ name: 'entity' });
                    var account = result.getValue({ name: 'account' });
                    var memo = result.getValue({ name: 'memo' });
                    var amount = result.getValue({ name: 'amount' });

                    facturas.push({
                        id: id,
                        tranDate: tranDate,
                        postingPeriod: postingPeriod,
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
         * Funcion para obtener los informes de gastos pagados
         */
        function searchExpenseReports() {
            try{
                var informes = []
                var informesSearch = search.create({
                    type: "expensereport",
                    filters:
                    [
                       ["type","anyof","ExpRept"], 
                       "AND", 
                       ["voided","is","F"], 
                       "AND", 
                       ["mainline","is","T"], 
                       "AND", 
                       ["status","anyof","ExpRept:I"],
                       "AND", 
                       ["trandate","within","lastmonth"]
                    ],
                    columns:
                    [
                        "internalid",
                        search.createColumn({
                            name: "ordertype",
                            sort: search.Sort.ASC
                        }),
                        "trandate",
                        "postingperiod",
                        "type",
                        "tranid",
                        "entity",
                        "account",
                        "amount"
                    ]
                 });
                 var searchResultCount = informesSearch.runPaged().count;
                 log.debug("expenseReportSearchObj result count",searchResultCount);
                 informesSearch.run().each(function(result){
                    // .run().each has a limit of 4,000 results
                    var id = result.getValue({ name: 'internalid' });
                    var tranDate = result.getValue({ name: 'trandate' });
                    var postingPeriod = result.getValue({ name: 'postingperiod' });
                    var type = result.getValue({ name: 'type' });
                    var tranId = result.getValue({ name: 'tranid' });
                    var entity = result.getValue({ name: 'entity' });
                    var account = result.getValue({ name: 'account' });
                    var amount = result.getValue({ name: 'amount' });

                    informes.push({
                        id: id,
                        tranDate: tranDate,
                        postingPeriod: postingPeriod,
                        type: type,
                        tranId: tranId,
                        entity, entity,
                        account: account,
                        amount: amount
                    })
                    return true;
                 });                 
            } catch (error) {
                log.error({ title: 'Error on searchExpenseReports', details: error })
            }
            return informes;
        }

        /**
         * Funcion para obtener las polizas de diario
         */
        function searchDailyPolicy() {
            try {
                var polizas = []
                var polizasSearch = search.create({
                    type: "journalentry",
                    filters:
                    [
                       ["type","anyof","Journal"], 
                       "AND", 
                       ["voided","is","F"], 
                       "AND", 
                       ["mainline","is","T"], 
                       "AND", 
                       ["status","anyof","Journal:B"],
                       "AND", 
                       ["account","anyof","186"], 
                       "AND", 
                       ["trandate","within","lastmonth"]
                    ],
                    columns:
                    [
                        "internalId",
                        search.createColumn({
                            name: "ordertype",
                            sort: search.Sort.ASC
                        }),
                        "trandate",
                        "postingperiod",
                        "type",
                        "tranid",
                        "entity",
                        "account",
                        "memo",
                        "amount"
                    ]
                 });
                 var searchResultCount = polizasSearch.runPaged().count;
                 log.debug("dailyPolicySearchObj result count",searchResultCount);
                 polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: 'internalid' });
                    var trandDate = result.getValue({ name: 'trandate' });
                    var postingPeriod = result.getValue({ name: 'postingperiod' });
                    var type = result.getValue({ name: 'type' });
                    var tranId = result.getValue({ name: 'tranid' });
                    var entity = result.getValue({ name: 'entity' });
                    var account = result.getValue({ name: 'account' });
                    var memo = result.getValue({ name: 'memo' });
                    var amount = result.getValue({ name: 'amount' });

                    polizas.push({
                        id:id,
                        tranDate: trandDate,
                        postingPeriod: postingPeriod,
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
                log.error({ title: 'Error on searchDailyPolicy', details: error });
            }
            return polizas;
        }

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
