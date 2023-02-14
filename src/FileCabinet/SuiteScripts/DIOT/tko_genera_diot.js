/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search'],

    (runtime, search) => {
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
                /* BG Facturas */
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
                       ["trandate","within","lastmonth"],
                       "AND", 
                       ["vendor.custentity_tko_diot_prov_type","anyof","1","2","3"]
                    ],
                    columns:
                    [
                       "internalid",
                       "trandate",
                       "postingperiod",
                       "type",
                       "tranid",
                       "entity",
                       "account",
                       "memo",
                       "amount",
                       search.createColumn({
                        name: "custentity_tko_diot_prov_type",
                        join: "vendor"
                       }),
                       "custbody_mx_operation_type"
                    ]
                });
                // var searchResultCount = facturaSearch.runPaged().count;
                // log.debug("vendorBillSearchObj result count",searchResultCount);
                facturaSearch.run().each(function(result){

                    /* 
                        var type_tercero = result.getValue({name: vendor.custentity_tko_diot_prov_type});
                        var op_type = result.getValue({name: tipooperacion});
                        var proveedor = result.getValue({name: entity});
                    */

                    facturas.push({
                        id: result.getValue({ name: 'internalid' }),
                        tranId: result.getValue({ name: 'tranid' }),
                        tranDate: result.getValue({ name: 'trandate' }),
                        postingPeriod: result.getValue({ name: 'postingperiod' }),
                        type: result.getValue({ name: 'type' }),
                        proveedor: result.getValue({ name: 'entity' }),
                        account: result.getValue({ name: 'account' }),
                        memo: result.getValue({ name: 'memo' }),
                        amount: result.getValue({ name: 'amount' }),
                        tipoTercero: result.getValue({ name: 'vendor.custentity_tko_diot_prov_type' }),
                        tipoOperacion: result.getValue({ name: 'custbody_mx_operation_type'})
                    });
                });

                /* BG Informes */
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
                       ["trandate","within","lastmonth"], 
                       "AND", 
                       ["vendorline.custentity_tko_diot_prov_type","anyof","1","2","3"]
                    ],
                    columns:
                    [
                        "internalid",
                        "trandate",
                        "postingperiod",
                        "type",
                        "tranid",
                        "entity",
                        "account",
                        "amount",
                        search.createColumn({
                            name: "custentity_tko_diot_prov_type",
                            join: "vendorLine"
                        }),
                        "custbody_mx_operation_type"
                        /* 
                            custcol_tko_diot_prov_type
                        */
                    ]
                });
                informesSearch.run().each(function(result){
                    informes.push({
                        id: result.getValue({ name: 'internalid' }),
                        tranDate: result.getValue({ name: 'trandate' }),
                        postingPeriod: result.getValue({ name: 'postingperiod' }),
                        type: result.getValue({ name: 'type' }),
                        tranId: result.getValue({ name: 'tranid' }),
                        entity: result.getValue({ name: 'entity' }),
                        account: result.getValue({ name: 'account' }),
                        amount: result.getValue({ name: 'amount' }),
                        proveedor: result.getValue({ name: 'vendorLine' }),
                        tipoTercero: result.getValue({ name: 'vendorLine.custentity_tko_diot_prov_type' }),
                        tipoOperacion: result.getValue({ name: 'custbody_mx_operation_type' })
                    })
                }); 

                /* BG Polizas */
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
                       ["trandate","within","lastmonth"], 
                       "AND", 
                       ["vendorline.custentity_tko_diot_prov_type","anyof","1","2","3"]
                    ],
                    columns:
                    [
                        "internalId",
                        "trandate",
                        "postingperiod",
                        "type",
                        "tranid",
                        "entity",
                        "account",
                        "memo",
                        "amount",
                        search.createColumn({
                            name: "custentity_tko_diot_prov_type",
                            join: "vendorLine"
                        })
                    ]
                });
                polizasSearch.run().each(function(result){
                    polizas.push({
                        id: result.getValue({ name: 'internalid' }),
                        tranDate: result.getValue({ name: 'trandate' }),
                        postingPeriod: result.getValue({ name: 'postingperiod' }),
                        type: result.getValue({ name: 'type' }),
                        tranId: result.getValue({ name: 'tranid' }),
                        entity: result.getValue({ name: 'entity' }),
                        account: result.getValue({ name: 'account' }),
                        memo: result.getValue({ name: 'memo' }),
                        amount: result.getValue({ name: 'amount' }),
                        proveedor: result.getValue({ name: 'vendorLine' }),
                        tipoTercero: result.getValue({ name: 'vendorLine.custentity_tko_diot_prov_type' })
                    })
                });
                
                /* Guardar busquedas en un arreglo de objetos */
                var datos_transacciones = []

                if (facturas && informes && polizas) {
                    datos_transacciones.push({
                        facturas_obj: facturas,
                        informes_obj: informes,
                        polizas_obj: polizas
                    });
                }

                return datos_transacciones;

            } catch (error) {
                log.error({ title: 'Error en la busqueda de transacciones', details: error })
            }

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
