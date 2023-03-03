/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url'],

    (runtime, search, url) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            try{

                var objScript = runtime.getCurrentScript();
                var subsidiaria = objScript.getParameter({ name: "custscript_tko_diot_subsidiary" });
                var periodo = objScript.getParameter({ name: "custscript_tko_diot_periodo" });
                
                log.audit({title: 'MR', details: "Se esta ejecutando el MR: getInputData"});
                var datos = [];
                datos.push({
                    'Subsidiaria': subsidiaria,
                    'Periodo': periodo
                })
                log.debug('Datos', datos);

                var facturasProv = searchVendorBill(subsidiaria, periodo);
                var informesGastos = searchExpenseReports(subsidiaria, periodo);
                var polizasDiario = searchDailyPolicy(subsidiaria, periodo);

                if(facturasProv.length == 0 && informesGastos.length == 0 && polizasDiario.length == 0) {
                    log.debug('Busquedas', 'No se encontaron transacciones en ese periodo');
                } else {
                    log.debug("Facturas", facturasProv);
                    log.debug("Informes", informesGastos);
                    log.debug("Polizas", polizasDiario);
                }

                //return [facturasProv, informesGastos, polizasDiario];

            } catch (error) {
                log.error({ title: 'Error en la busqueda de transacciones', details: error })
            }

        }

        /**
         * Funcion para buscar las facturas de proveedores
         */
        function searchVendorBill(subsidiaria, periodo){
            var facturas = [];
            var facturaSearch = search.create({
                type: "vendorbill",
                filters:
                [
                    ["type","anyof","VendBill"], 
                    "AND", 
                    ["voided","is","F"], 
                    "AND", 
                    ["mainline","is","F"],
                    // "AND", 
                    // ["status","anyof","VendBill:B"], (para pruebas, estado = pagado por completo)
                    "AND", 
                    ["vendor.custentity_tko_diot_prov_type","anyof","1","2","3"], 
                    "AND", 
                    ["custbody_tko_tipo_operacion","anyof","1","2","3"], 
                    "AND", 
                    ["postingperiod","abs",periodo],
                    "AND", 
                    ["subsidiary","anyof",subsidiaria],
                    "AND", 
                    ["taxline","is","F"]
                ],
                columns:
                [
                    "internalid",
                    "type",
                    search.createColumn({
                       name: "internalid",
                       join: "vendor",
                    }),
                    search.createColumn({
                       name: "custentity_tko_diot_prov_type",
                       join: "vendor"
                    }),
                    "custbody_tko_tipo_operacion",
                    "amount",
                    "netamountnotax",
                    "taxamount"
                ]
            });

            facturaSearch.run().each(function(result){
                var id = result.getValue({ name: 'internalid' });
                var proveedor = result.getValue({ name: 'internalid', join: "vendor" });
                var tipoTercero = result.getValue({ name: 'custentity_tko_diot_prov_type', join: "vendor" });
                var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                var importe = result.getValue({ name: 'netamountnotax' });
                var impuestos = result.getValue({ name: 'taxamount' });
                var iva = 0;

                iva = calculaIVA(impuestos,importe,iva);

                facturas.push({
                    id: id,
                    proveedor: proveedor,
                    tipoTercero: tipoTercero,
                    tipoOperacion: tipoOperacion,
                    iva: iva,
                    importe: importe
                });

                return true;

                // var rfc = search.lookupFields({
                //     type: search.Type.VENDOR,
                //     id: proveedor,
                //     columns: ['custentity_mx_rfc']
                // });
                // var nombreExtranjero, pais, nacionalidad;

                // if(tipoTercero == 1){ //proveedor nacional
                //     /**
                //      * Obligatorio RFC
                //      */
                //     log.debug('RFC', rfc);                    
                // } else if (tipoTercero == 2){ //proveedor extranjero
                //     /**
                //      * Opcional RFC
                //      * Tax ID
                //      * Nombre del extranjero
                //      * Pais de residencia (aplica si nombre de extranjero tiene un valor)
                //      * Nacionalidad (aplica si nombre de extranjero tiene un valor)
                //      */
                //     if(rfc != '') {
                //         log.debug('RFC', rfc); 
                //     }
                //     var taxID = search.lookupFields({
                //         type: search.Type.VENDOR,
                //         id: proveedor,
                //         columns: ['taxidnum']
                //     });
                //     nombreExtranjero = search.lookupFields({
                //         type: search.Type.VENDOR,
                //         id: proveedor,
                //         columns: ['custentity_tko_nombre_extranjero']
                //     });
                //     log.debug('Tax ID', taxID);
                //     log.debug('Nombre del extranjero', nombreExtranjero);
                //     if(nombreExtranjero != ''){
                //         pais = search.lookupFields({
                //             type: search.Type.VENDOR,
                //             id: proveedor,
                //             columns: ['custentity_tko_pais_residencia']
                //         });
                //         nacionalidad = search.lookupFields({
                //             type: search.Type.VENDOR,
                //             id: proveedor,
                //             columns: ['custentity_tko_nacionalidad']
                //         });
                //         log.debug('Pais de Residencia', pais);
                //         log.debug('Nacionalidad', nacionalidad);
                //     }
                // } else { //proveedor global
                //     /**
                //      * NO Obligatorio RFC
                //      */
                // }
            });
            return facturas;
        }

        function searchExpenseReports(subsidiaria, periodo){
            var informes = [];
            var informesSearch = search.create({
                type: "expensereport",
                filters:
                [
                    ["type","anyof","ExpRept"], 
                    "AND", 
                    ["voided","is","F"], 
                    "AND", 
                    ["mainline","any",""], 
                    // "AND", 
                    // ["status","anyof","ExpRept:I"],  (para prueba, estado = pagado por completo)
                    "AND", 
                    ["custcol_tko_diot_prov_type","anyof","2","1","3"],
                    "AND",
                    ["custbody_tko_tipo_operacion","anyof","1","2","3"], 
                    "AND", 
                    ["postingperiod","abs",periodo], 
                    "AND", 
                    ["subsidiary","anyof",subsidiaria], 
                    "AND", 
                    ["taxline","is","F"]
                ],
                columns:
                [
                    "internalid",
                    "type",
                    "custbody_tko_tipo_operacion",
                    "custcol_tko_diot_prov_type",
                    "custcol_tkio_proveedor",
                    "amount",
                    "netamountnotax",
                    "taxamount"
                ]
            });
            informesSearch.run().each(function(result){
                var id = result.getValue({ name: 'internalid' });
                var proveedor = result.getValue({ name: 'custcol_tkio_proveedor' });
                var tipoTercero = result.getValue({ name: 'custcol_tko_diot_prov_type' });
                var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion' });
                var importe = result.getValue({ name: 'netamountnotax' });
                var impuestos = result.getValue({ name: 'taxamount' });
                var iva = 0;

                iva = calculaIVA(impuestos, importe, iva);

                informes.push({
                    id: id,
                    proveedor: proveedor,
                    tipoTercero: tipoTercero,
                    tipoOperacion: tipoOperacion,
                    iva: iva,
                    importe: importe
                });

                return true;
            });

            return informes;
        }

        function calculaIVA(impuestos, importe, iva){
            if (impuestos != 0 || impuestos != '') {
                iva = (impuestos * 100) / importe;
            } else {
                iva = 0;
            }
            if(iva < 0){
                iva = iva * -1;
            }

            return iva;
        }

        function searchDailyPolicy(subsidiaria, periodo){
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
                    ["custcol_tko_diot_prov_type","anyof","1","2","3"], 
                    "AND", 
                    ["custbody_tko_tipo_operacion","anyof","1","2","3"], 
                    "AND", 
                    ["postingperiod","abs",periodo], 
                    "AND", 
                    ["subsidiary","anyof",subsidiaria]
                ],
                columns:
                [
                    search.createColumn({
                        name: "internalid",
                        summary: "GROUP"
                     }),
                     search.createColumn({
                        name: "type",
                        summary: "GROUP"
                     }),
                     search.createColumn({
                        name: "tranid",
                        summary: "GROUP"
                     }),
                     search.createColumn({
                        name: "account",
                        summary: "GROUP"
                     }),
                     search.createColumn({
                        name: "custcol_tko_diot_prov_type",
                        summary: "GROUP"
                     }),
                     search.createColumn({
                        name: "custbody_tko_tipo_operacion",
                        summary: "GROUP"
                     }),
                     search.createColumn({
                        name: "custcol_tkio_proveedor",
                        summary: "GROUP"
                     })
                ]
            });
            polizasSearch.run().each(function(result){
                var id = result.getValue({ name: 'internalid', summary: 'GROUP' });
                var proveedor = result.getValue({ name: 'custcol_tkio_proveedor', summary: 'GROUP' });
                var tipoTercero = result.getValue({ name: 'custcol_tko_diot_prov_type', summary: 'GROUP' });
                var tipoOperacion = result.getValue({ name: 'custbody_tko_tipo_operacion', summary: 'GROUP' });

                polizas.push({
                    id: id,
                    proveedor: proveedor,
                    tipoTercero: tipoTercero,
                    tipoOperacion: tipoOperacion
                })
                return true;
            });

            return polizas;
        }


        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {

            var results = JSON.parse(mapContext.value);
            

            try{

            }catch(error){

            }
        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {

        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {

        }


        return {getInputData, map, reduce, summarize}

    });
