/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', 'N/record', 'N/file', 'N/redirect', 'N/config', 'N/email', './fb_diot_constants_lib', './moment_diot.js'],

 (runtime, search, url, record, file, redirect, config, email, values, moment) => {

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

    var taxRateArray = new Array();
    var erroresArray = new Array();

    const SCRIPTS_INFO = values.SCRIPTS_INFO;
    const RECORD_INFO = values.RECORD_INFO;
    const STATUS_LIST_DIOT = values.STATUS_LIST_DIOT;
    const RUNTIME = values.RUNTIME;
    const OPERATION_TYPE = values.OPERATION_TYPE;

    const getInputData = (inputContext) => {
        try{

            /** Se obtienen los parametros dados por el usuario */
            var objScript = runtime.getCurrentScript();
            var subsidiaria = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.SUBSIDIARY });
            var periodo = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.PERIOD });
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID }); 
            //log.debug('Datos', subsidiaria + " " + periodo);

            log.audit({title: 'Estado', details: "Se esta ejecutando el getInputData"});

            var otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.OBTAINING_DATA
                }
            });

            /** Se obtiene el motor que se esta usando (legacy or suitetax) */
            var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });
            log.audit({title: 'suitetax', details: suitetax});
            
            /* Se realiza la búsqueda de todos los códigos de impuesto */
            var codigosImpuesto = searchCodigoImpuesto(suitetax);

            return codigosImpuesto;

        } catch (error) {
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                    [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                }
            });
            log.error({ title: 'Error en la busqueda de Códigos de Impuesto', details: error });
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

         try{
            var objScript = runtime.getCurrentScript();
            /** Se obtiene el motor que se esta usando (legacy or suitetax) y el id del registro creado */
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
            var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });
            log.audit({title: 'Estado', details: "Se esta ejecutando el Map"});
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.VALIDATING_DATA
                }
            });
            var results = JSON.parse(mapContext.value);
            //log.debug('Resultados de getInput', results);

            // Revisar la carga de registros de los códigos de impuesto
            var taxRate, codeName, taxType, cuenta1, cuenta2;

            if(suitetax){
                /* Registro de cada resultado del map */
                var taxCodeRecord = record.load({
                    type: record.Type.SALES_TAX_ITEM,
                    id: results.id
                });

                /* Se obtiene el nombre del código, la tasa, el tipo de impuesto y las cuentas pertenecientes a cada código de impuesto*/
                taxRate = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_RATE });
                codeName = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_CODE });
                taxType = taxCodeRecord.getText({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.TAX_TYPE });
                cuenta1 = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.RECEIVABLES_ACCOUNT });
                cuenta2 = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.SUITETAX.PAYABLES_ACCOUNT });
            }else{
                /* Registro de cada resultado del map */
                var taxCodeRecord = record.load({
                    type: record.Type.SALES_TAX_ITEM,
                    id: results.id
                });

                taxRate = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_RATE });
                codeName = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_CODE });
                taxType = taxCodeRecord.getText({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.TAX_TYPE });
                cuenta1 = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.PURCHASE_ACCOUNT });
                cuenta2 = taxCodeRecord.getValue({ fieldId: RECORD_INFO.SALES_TAX_RECORD.FIELDS.LEGACY.SALE_ACCOUNT });
            }

            var numCodigos = searchCodigoImpuesto(suitetax).runPaged().count;

            /* Se ingresan los datos obtenidos en un arreglo para mandar el valor al reduce */
            taxRateArray.push({
                taxRate: taxRate,
                codeName: codeName,
                taxType: taxType,
                cuenta1: cuenta1,
                cuenta2: cuenta2
            })

            /* Se manda el último arreglo al reduce, es decir el que ya contiene todos los datos */
            if(taxRateArray.length == numCodigos){
                mapContext.write({
                    key: "taxRate",
                    value: JSON.stringify(taxRateArray)
                }); 
            }   

        }catch(error){
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                    [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                }
            });
            log.error({ title: 'Error al realizar el registro de cada resultado', details: error });
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

        try{
            log.audit({ title: 'Estado', details: "Se esta ejecutando el Reduce" });
            log.audit({ title: 'Codigos de impuesto', details: reduceContext });
            
            /** Se obtienen los parametros dados por el usuario */
            var objScript = runtime.getCurrentScript();
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
            var oneWorldFeature = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUBSIDIARIES });
            log.audit({ title:'OneWorld', details: oneWorldFeature });
            var subsidiaria = '';
            if(oneWorldFeature){
                subsidiaria = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.SUBSIDIARY });
            }
            var periodo = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.PERIOD });
            var search_factura = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.BUSQUEDA_FACTURAS });

            var nombreSubsidiaria = '', nombrePeriodo = '';
            
            var nombrePer = search.lookupFields({
                type: search.Type.ACCOUNTING_PERIOD,
                id: periodo,
                columns: [RECORD_INFO.ACCOUNTINGPERIOD_RECORD.FIELDS.NAME]
            });
            var nombrePeriodo = nombrePer.periodname;

            //si es oneWorld se obtiene el nombre de la subsidiaria
            if(oneWorldFeature){
                var nombreSub = search.lookupFields({
                    type: search.Type.SUBSIDIARY,
                    id: subsidiaria,
                    columns: [RECORD_INFO.SUBSIDIARY_RECORD.FIELDS.NAME_NOHIERARCHY]
                });
                nombreSubsidiaria = nombreSub.namenohierarchy;
            }
            
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.BUILDING,
                }
            });

            /** Se obtiene el motor que se esta usando (legacy or suitetax) */
            var suitetax = runtime.isFeatureInEffect({ feature: RUNTIME.FEATURES.SUITETAX });

            /** Se obtienen los valores enviados en el map (códigos de impuesto encontrados en la búsqueda ) */
            var valores = JSON.parse(reduceContext.values[0]);

            /** Se realiza una búsqueda del desglose de impuestos */
            var desgloseImpuestos = search.lookupFields({
                type: RECORD_INFO.DESGLOSE_TAX_RECORD.ID,
                id: 1,
                columns: [RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.EXENTO, RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.IVA, RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.RETENCION]
            });

            var exentos = desgloseImpuestos[RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.EXENTO];
            log.audit({ title: 'Exentos', details: exentos });
            var iva = desgloseImpuestos[RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.IVA];
            log.audit({ title: 'Iva', details: iva });
            var retenciones = desgloseImpuestos[RECORD_INFO.DESGLOSE_TAX_RECORD.FIELDS.RETENCION];
            log.audit({ title: 'Retenciones', details: retenciones });

            /** Se realiza la búsqueda de las distintas transacciones */
            var facturasProv = [], informesGastos = [], polizasDiario =[];
            /* if(oneWorldFeature){
                var resFact = searchVendorBill(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones);
                // log.audit({title: 'Res Fact', details: resFact});
                facturasProv = resFact[0].facturas;
                var proveedores = resFact[0].arrayProv;
                var idFacturas = resFact[0].arrayFactId;
                log.audit({title: 'Facturas Resultados', details: facturasProv});
                log.audit({title: 'Proveedores Resultados', details: proveedores});
                log.audit({title: 'Id Fact Resultados', details: idFacturas});
                var credito = [];
                if(facturasProv.length != 0){ //si existen facturas se buscan creditos de factura
                    credito = searchFacturasCredito(proveedores, idFacturas, suitetax);
                    log.audit({title: 'Credito', details: credito });
                    //agregamos el credito a cada factura
                    var pastIdFact = '', pastProv = '';
                    for(var x = 0; x < facturasProv.length; x++){
                        var imp = 0;
                        //se verifica que no se repitan las facturas y el proveedor para no agregar el credito dos veces
                        if((pastIdFact != facturasProv[x].id) && (pastProv != facturasProv[x].proveedor)){
                            for(var y = 0; y < credito.length; y++){
                                if((credito[y].idFactura == facturasProv[x].id) && (credito[y].proveedor == facturasProv[x].proveedor)){
                                    var impuesto = parseFloat(credito[y].impuesto);
                                    impuesto = Math.abs(impuesto);
                                    imp = imp + impuesto;
                                }
                            }
                            facturasProv[x].credito = imp;
                            pastIdFact = facturasProv[x].id;
                            pastProv = facturasProv[x].proveedor;
                        }else{
                            facturasProv[x].credito = '';
                        }
                    }

                    log.audit({title: 'Facturas con Credito', details: facturasProv});
                }
                informesGastos = searchExpenseReports(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones);
                log.audit({title: 'Informes Resultados', details: informesGastos});
                polizasDiario = searchDailyPolicy(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones);
                log.audit({title: 'Polizas Resultados', details: polizasDiario});
            }else{
                var resFact = searchVendorBillOW(periodo, suitetax, valores, exentos, iva, retenciones);
                facturasProv = resFact[0].facturas;
                var proveedores = resFact[0].arrayProv;
                var idFacturas = resFact[0].arrayFactId;
                log.audit({title: 'Facturas Res', details: facturasProv});
                log.audit({title: 'Proveedores Res', details: proveedores});
                log.audit({title: 'Id Fact Res', details: idFacturas});
                var credito = [];
                if(facturasProv.length != 0){ //si existen facturas se buscan creditos de factura
                    credito = searchFacturasCredito(proveedores, idFacturas, suitetax);
                    log.audit({title: 'Credito', details: credito });
                    //agregamos el credito a cada factura
                    var pastIdFact = '', pastProv = '';
                    for(var x = 0; x < facturasProv.length; x++){
                        var imp = 0;
                        //se verifica que no se repitan las facturas y el proveedor para no agregar el credito dos veces
                        if((pastIdFact != facturasProv[x].id) && (pastProv != facturasProv[x].proveedor)){
                            for(var y = 0; y < credito.length; y++){
                                if((credito[y].idFactura == facturasProv[x].id) && (credito[y].proveedor == facturasProv[x].proveedor)){
                                    var impuesto = parseFloat(credito[y].impuesto);
                                    impuesto = Math.abs(impuesto);
                                    imp = imp + impuesto;
                                }
                            }
                            facturasProv[x].credito = imp;
                            pastIdFact = facturasProv[x].id;
                            pastProv = facturasProv[x].proveedor;
                        }else{
                            facturasProv[x].credito = '';
                        }
                    }

                    log.audit({title: 'Facturas con Credito', details: facturasProv});
                }
                informesGastos = searchExpenseReportsOW(periodo, suitetax, valores, exentos, iva, retenciones);
                log.audit({title: 'Informes Res', details: informesGastos});
                polizasDiario = searchDailyPolicyOW(periodo, suitetax, valores, exentos, iva, retenciones);
                log.audit({title: 'Polizas Res', details: polizasDiario});
            } */
            var resFact = searchVendorBillPrueba(subsidiaria, periodo, search_factura, suitetax, valores, exentos, iva, retenciones, recordID);
            facturasProv = resFact[0].facturas;
            var proveedores = resFact[0].arrayProv;
            var idFacturas = resFact[0].arrayFactId;
            log.audit({title: 'Facturas Resultados', details: facturasProv});
            log.audit({title: 'Proveedores Resultados', details: proveedores});
            log.audit({title: 'Id Fact Resultados', details: idFacturas});

            /** Verifica si existe algún error */
            var erroresTran = '';
            var error = false;
            if(facturasProv.length != 0){
                for(var i = 0; i < facturasProv.length; i++){
                    if(facturasProv[i].errores != ''){
                        error = true;
                        erroresTran = erroresTran + facturasProv[i].errores;
                    }
                }
            }
            if(informesGastos.length != 0){
                for(var i = 0; i < informesGastos.length; i++){
                    if(informesGastos[i].errores != ''){
                        error = true;
                        erroresTran = erroresTran + informesGastos[i].errores;
                    }
                }
            }
            if(polizasDiario.length != 0){
                for(var i = 0; i < polizasDiario.length; i++){
                    if(polizasDiario[i].errores != ''){
                        error = true;
                        erroresTran = erroresTran + polizasDiario[i].errores;
                    }
                }
            }

            //Se separan los errores y se meten en un arreglo
            var erroresArrayAux = erroresTran.split('/');
            //Se meten en un arreglo final para evitar los errores repetidos
            for (var i = 0; i < erroresArrayAux.length; i++){
                if(erroresArray.length != 0){
                    var existe = buscarError(erroresArrayAux[i], erroresArray);
                    if(!existe){
                        erroresArray.push(erroresArrayAux[i]);
                    }
                }else{
                    erroresArray.push(erroresArrayAux[i]);
                }
            }

            /** Se crea el folder raíz y el archivo si no hay errores */
            if(!error){
                var nombreFolder = RECORD_INFO.FOLDER_RECORD.FIELDS.VALUE;
                //se realiza una búsqueda para ver si ya existe la carpeta
                var folder = searchFolder(nombreFolder);
                var folderId;
                if(folder.runPaged().count != 0){ //existe
                    folder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                    log.debug('Info', 'La carpeta ' + folderId + ' existe');
                }else{ // si no existe se crea el folder
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.debug('Info', 'Se creo la carpeta con id ' + folderId);
                }

                /** Parámetros desde las preferencias de la empresa */
                var tipoGuardado = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.TIPO_GUARDADO });
                log.debug('Tipo guardado', tipoGuardado );
                var nombreArchivo = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.NOMBRE_ARCHIVO });
                log.debug('Nombre archivo', nombreArchivo);

                // si no es oneWorld el tipo de guardado solo será por periodo
                if(oneWorldFeature == false){
                    tipoGuardado = 2;
                }
                // si no se especifico el tipo de guardado, el default será por subsidiarias
                if(tipoGuardado == ''){
                    tipoGuardado = 1;
                }

                //se manda crear el folder dentro de la carpeta raíz y se obtiene el id de la carpeta
                var subFolderId = createFolder(nombreSubsidiaria, nombrePeriodo, tipoGuardado, folderId);
                log.debug('SubFolder', subFolderId);

                
                /** Se obtienen los datos con el que se va a guardar el nombre del archivo */
                nombreArchivo = nombreArchivo.toUpperCase();
                var arrayDatos = nombreArchivo.split('_');
                var fecha = new Date();
                //se quitan los espacios de nombre subsidiaria y periodo
                var subsi = nombreSubsidiaria.replace(/\s+/g, '');
                var per = nombrePeriodo.replace(/\s+/g, '')
                var nombreTxt = '';
                for(var i = 0; i < arrayDatos.length; i++){
                    var dato = getData(arrayDatos[i], subsi, per, fecha);
                    nombreTxt = nombreTxt + dato;
                    if((i+1) != arrayDatos.length){
                        nombreTxt = nombreTxt + '_';
                    }
                }
                log.audit({ title: 'NombreTXT', details: nombreTxt });

                // Estructura de datos
                var idProv = new Array();
                idProv = buscaProveedores(facturasProv, informesGastos, polizasDiario);
                log.debug('Array Prov', idProv);

                /**
                 * ! Columnas para la DIOT
                 * ? tercero
                 * ? operacion
                 * ? rfc
                 * ? taxid
                 * ? nombreExtranjero
                 * ? pais
                 * ? nacionalidad
                 * ? iva1516(importe)
                 * ? pendiente(región norte)(impuestos)
                 * ? importacion1516(impuestos)
                 * ? importacion1011(impuestos)
                 * ? importacionexentos(siniva)
                 * ? iva0(siniva)
                 * ? retencion(impuestos)
                 * ? devoluciones(impuestos)
                 */
                var arrayTxt = new Array();

                if(idProv.length != 0){
                    
                    //se estructuran los datos
                    arrayTxt = estructuraDatos(idProv, facturasProv, informesGastos, polizasDiario, suitetax);
                    if(arrayTxt.length != 0){ //si el archivo contiene algo

                        //Se checa que el contenido del archivo no este vacío
                        var vacio = true;
                        for(var i = 0; i < arrayTxt.length; i++){
                            if(arrayTxt[i] != ''){
                                vacio = false;
                            }
                        }

                        if(!vacio){ //si hay información
                            var txt = arrayTxt.toString();
                            var txtFinal = txt.replace(/,+/g,'');
                            
                            /** Se busca que no exista el nombre del archivo en la carpeta */
                            var archivos = [];
                            var folderSearchObj = search.create({
                                type: RECORD_INFO.FOLDER_RECORD.ID,
                                filters:
                                [
                                [RECORD_INFO.FOLDER_RECORD.FIELDS.ID,search.Operator.ANYOF,subFolderId], 
                                "AND", 
                                [RECORD_INFO.FOLDER_RECORD.FIELDS.FILE_NAME,search.Operator.STARTSWITH,nombreTxt]
                                ],
                                columns:
                                [
                                search.createColumn({
                                    name: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                                    join: RECORD_INFO.FOLDER_RECORD.FIELDS.FILE,
                                    sort: search.Sort.DESC
                                })
                                ]
                            });
                            var numArchivos = folderSearchObj.runPaged().count;
                            folderSearchObj.run().each(function(result){
                                var archivo = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME, join: RECORD_INFO.FOLDER_RECORD.FIELDS.FILE });
                                archivos.push(archivo);
                                return true;
                            });
                            if(numArchivos == 0){//no existe el nombre
                            
                            }else{
                                var numCaracteres = nombreTxt.length;
                                //log.debug('Archivos',archivos);
                                log.debug('Archivos', archivos[0]);
                                var lastFile = archivos[0];
                                var n = lastFile.substring(numCaracteres); //obtiene el ultimo numero de archivo
                                if(n != ''){
                                    var num = n.replace(/_+/g,'');
                                    num = parseFloat(num) + 1;
                                    nombreTxt = nombreTxt + '_' + num;
                                }else{ //es el primer archivo
                                    nombreTxt = nombreTxt + '_' + 1;
                                }
                            }
                            log.audit({ title: 'Nombre Final Archivo', details: nombreTxt });
    
                            /** Se crea el archivo txt, se indica el folder en el que se va a guardar*/
                            var fileObj = file.create({
                                name    : nombreTxt,
                                fileType: file.Type.PLAINTEXT,
                                folder: subFolderId,
                                contents: txtFinal
                            });
                            var fileId = fileObj.save();
                            log.audit({ title: 'ID Archivo', details: fileId });
                            otherId = record.submitFields({
                                type: RECORD_INFO.DIOT_RECORD.ID,
                                id: recordID,
                                values: {
                                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.COMPLETE,
                                    [RECORD_INFO.DIOT_RECORD.FIELDS.FOLDER_ID]: subFolderId,
                                    [RECORD_INFO.DIOT_RECORD.FIELDS.FILE]: fileId
                                }
                            });
                        }else{ //si no contiene nada, no se crea el archivo
                            var error = 'El archivo no se creo debido a que las transacciones no contienen importes y/o impuestos pertenecientes a cada columna ';
                            otherId = record.submitFields({
                                type: RECORD_INFO.DIOT_RECORD.ID,
                                id: recordID,
                                values: {
                                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                                    [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error
                                }
                            });
                        }
                    }
                }else{ //no existen transacciones
                    var error = 'No se encontaron transacciones en ese periodo';
                    otherId = record.submitFields({
                        type: RECORD_INFO.DIOT_RECORD.ID,
                        id: recordID,
                        values: {
                            [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                            [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error
                        }
                    });
                }

            } else{ //si hay error no se crea el folder ni el archivo, solo se actualiza el campo de estado
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: erroresArray
                    }
                });
            }

            /** Verifica que las búsquedas no esten vacías */
            if(facturasProv.length == 0 && informesGastos.length == 0 && polizasDiario.length == 0) {
                log.debug('Busquedas', 'No se encontaron transacciones en ese periodo');
                // tener en cuenta que aqui se puede mandar ese texto en un key de objeto para manejar error directamente en el pantalla de la DIOT
            } else {
                /* log.debug("Facturas", facturasProv);
                log.debug("Informes", informesGastos);
                log.debug("Polizas", polizasDiario); */
            }
        }catch(error){
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                    [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                }
            });
            log.error({ title: 'Error en las búsquedas de transacciones', details: error });
        }
    }

    function estructuraDatos(idProv, facturasProv, informesGastos, polizasDiario, suitetax){
        try{
            var arrayTxt = new Array();
            for (var id_prov = 0; id_prov < idProv.length; id_prov++) {
                var prov = idProv[id_prov];
                var tercero, operacion, rfc, taxid, nombreExtranjero, pais, nacionalidad, iva1516 = 0, regionNorte = 0, importacion1516 = 0, importacion1011 = 0, importacionExento = 0, iva0 = 0, exento = 0, retencion = 0, devoluciones = 0;
                if(facturasProv.length != 0){
                    for (var factura = 0; factura < facturasProv.length; factura++) {
                        var prov_operacion = facturasProv[factura].proveedor + facturasProv[factura].tipoOperacion;
                        if(prov_operacion == prov){
                            tercero = facturasProv[factura].tipoTercero;
                            operacion = facturasProv[factura].tipoOperacion;
                            rfc = facturasProv[factura].rfc;
                            taxid = facturasProv[factura].taxID;
                            nombreExtranjero = facturasProv[factura].nombreExtranjero;
                            pais = facturasProv[factura].paisResidencia;
                            nacionalidad = facturasProv[factura].nacionalidad;
                            var importe;
                            if(facturasProv[factura].importe != ""){
                                importe = parseFloat(facturasProv[factura].importe);
                                importe = Math.abs(importe);
                            }else{
                                importe = 0;
                            }
                            var impuestos;
                            if(facturasProv[factura].impuestos != ""){
                                impuestos = parseFloat(facturasProv[factura].impuestos);
                                impuestos = Math.abs(impuestos);
                            }else{
                                impuestos = 0;
                            }
                            var credito = facturasProv[factura].credito;
                            var tasa = parseFloat(facturasProv[factura].tasa);
                            tasa = Math.abs(tasa);
                            if(facturasProv[factura].tipoDesglose == 'Exento'){
                                if(facturasProv[factura].exportacionBienes == true){
                                    exento = exento + importe;
                                }else{
                                    importacionExento = importacionExento + importe;
                                }
                            }else if(facturasProv[factura].tipoDesglose == 'Iva'){
                                if (tasa == 0) {
                                    iva0 = iva0 + importe;
                                }else if(tasa == 8){ //zona fronteriza
                                    regionNorte = regionNorte + impuestos;
                                }else if(tasa == 15 || tasa == 16){
                                    if(facturasProv[factura].exportacionBienes == true){
                                        iva1516 = iva1516 + importe;
                                    }else{
                                        importacion1516 = importacion1516 + impuestos;
                                    }
                                }else if(tasa == 10 || tasa == 11){
                                    if(facturasProv[factura].exportacionBienes == false){
                                        importacion1011 = importacion1011 + impuestos;
                                    }
                                }
                            }else if(facturasProv[factura].tipoDesglose == 'Retenciones'){
                                retencion = retencion + impuestos;
                            }
   
                            if(credito != ''){
                               devoluciones = devoluciones + credito;
   
                                /* for(var cred = 0; cred < credito.length; cred++){
                                    var credImpuestos = parseFloat(credito[cred].impuesto);
                                    credImpuestos = Math.abs(credImpuestos);
                                    devoluciones = devoluciones + credImpuestos;
                                } */
                            }
                        }
                    }
                }
                if(informesGastos.length != 0){
                    for (var informe = 0; informe < informesGastos.length; informe++) {
                        var prov_operacion = informesGastos[informe].proveedor + informesGastos[informe].tipoOperacion;
                        if(prov_operacion == prov){
                            tercero = informesGastos[informe].tipoTercero;
                            operacion = informesGastos[informe].tipoOperacion;
                            rfc = informesGastos[informe].rfc;
                            taxid = informesGastos[informe].taxID;
                            nombreExtranjero = informesGastos[informe].nombreExtranjero;
                            pais = informesGastos[informe].paisResidencia;
                            nacionalidad = informesGastos[informe].nacionalidad;
                            var importe;
                            if(informesGastos[informe].importe != ""){
                                importe = parseFloat(informesGastos[informe].importe);
                                importe = Math.abs(importe);
                            }else{
                                importe = 0;
                            }
                            var impuestos;
                            if(informesGastos[informe].impuestos != ""){
                                impuestos = parseFloat(informesGastos[informe].impuestos);
                                impuestos = Math.abs(impuestos);
                            }else{
                                impuestos = 0;
                            }
                            var tasa = parseFloat(informesGastos[informe].tasa);
                            tasa = Math.abs(tasa);
                            if(informesGastos[informe].tipoDesglose == 'Exento'){
                                if(informesGastos[informe].importacionBienes == true){
                                    importacionExento = importacionExento + importe;
                                }else{
                                    exento = exento + importe;
                                }
                            }else if(informesGastos[informe].tipoDesglose == 'Iva'){
                                if (tasa == 0) {
                                    iva0 = iva0 + importe;
                                }else if(tasa == 8){ //zona fronteriza
                                    regionNorte = regionNorte + impuestos;
                                }else if(tasa == 15 || tasa == 16){
                                    if(informesGastos[informe].importacionBienes == true){
                                        importacion1516 = importacion1516 + impuestos;
                                    }else{
                                        iva1516 = iva1516 + importe;
                                    }
                                }else if(tasa == 10 || tasa == 11){
                                    if(informesGastos[informe].importacionBienes == true){
                                        importacion1011 = importacion1011 + impuestos;
                                    }
                                }
                            }else if(informesGastos[informe].tipoDesglose == 'Retenciones'){
                                retencion = retencion + impuestos;
                            }
                        }
                    }
                }
                if(polizasDiario.length != 0){
                    for (var poliza = 0; poliza < polizasDiario.length; poliza++) {
                        var prov_operacion = polizasDiario[poliza].proveedor + polizasDiario[poliza].tipoOperacion;
                        if(prov_operacion == prov){
                            tercero = polizasDiario[poliza].tipoTercero;
                            operacion = polizasDiario[poliza].tipoOperacion;
                            rfc = polizasDiario[poliza].rfc;
                            taxid = polizasDiario[poliza].taxID;
                            nombreExtranjero = polizasDiario[poliza].nombreExtranjero;
                            pais = polizasDiario[poliza].paisResidencia;
                            nacionalidad = polizasDiario[poliza].nacionalidad;
                            var importe;
                            if(polizasDiario[poliza].importe != ""){
                                importe = parseFloat(polizasDiario[poliza].importe);
                                importe = Math.abs(importe);
                            }else{
                                importe = 0;
                            }
                            var impuestos;
                            if(polizasDiario[poliza].impuestos != ""){
                                impuestos = parseFloat(polizasDiario[poliza].impuestos);
                                impuestos = Math.abs(impuestos);
                            }else{
                                impuestos = 0;
                            }
                            var tasa;
                            if(suitetax){
                                if(polizasDiario[poliza].codigos != ''){
                                    //traer los codigos que sean iva o retencion
                                    for(var codigo = 0; codigo < polizasDiario[poliza].codigos.length; codigo++){
                                        tasa = parseFloat(polizasDiario[poliza].codigos[codigo].tasa);
                                        tasa = Math.abs(tasa);
                                        if(polizasDiario[poliza].codigos[codigo].tipoDesglose != 'Exento'){
                                            if(polizasDiario[poliza].codigos[codigo].tipoDesglose == 'Iva'){
                                                if(tasa == 8){ //zona fronteriza
                                                    regionNorte = regionNorte + impuestos;
                                                    break;
                                                }else if(tasa == 15 || tasa == 16){
                                                    if(polizasDiario[poliza].importacionBienes == true){
                                                        importacion1516 = importacion1516 + impuestos;
                                                        break;
                                                    }else{
                                                        iva1516 = iva1516 + importe;
                                                        break;
                                                    }
                                                }else if(tasa == 10 || tasa == 11){
                                                    if(polizasDiario[poliza].importacionBienes == true){
                                                        importacion1011 = importacion1011 + impuestos;
                                                        break;
                                                    }
                                                }
                                            }else if(polizasDiario[poliza].codigos[codigo].tipoDesglose == 'Retenciones'){
                                                retencion = retencion + impuestos;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }else{
                                if(polizasDiario[poliza].tipoDesglose == ''){
                                    if(polizasDiario[poliza].codigos != ''){
                                        //traer los codigos que sean iva o retencion
                                        for(var codigo = 0; codigo < polizasDiario[poliza].codigos.length; codigo++){
                                            tasa = parseFloat(polizasDiario[poliza].codigos[codigo].tasa);
                                            tasa = Math.abs(tasa);
                                            if(polizasDiario[poliza].codigos[codigo].tipoDesglose != 'Exento'){
                                                if(polizasDiario[poliza].codigos[codigo].tipoDesglose == 'Iva'){
                                                    if(tasa == 8){ //zona fronteriza
                                                        regionNorte = regionNorte + impuestos;
                                                    }else if(tasa == 15 || tasa == 16){
                                                        if(polizasDiario[poliza].importacionBienes == true){
                                                            importacion1516 = importacion1516 + impuestos;
                                                        }else{
                                                            iva1516 = iva1516 + importe;
                                                        }
                                                    }else if(tasa == 10 || tasa == 11){
                                                        if(polizasDiario[poliza].importacionBienes == true){
                                                            importacion1011 = importacion1011 + impuestos;
                                                        }
                                                    }
                                                }else if(polizasDiario[poliza].codigos[codigo].tipoDesglose == 'Retenciones'){
                                                    retencion = retencion + impuestos;
                                                }
                                            }
                                        }
                                    }
                                }else{
                                    tasa = parseFloat(polizasDiario[poliza].tasa);
                                    tasa = Math.abs(tasa);
                                    if(polizasDiario[poliza].tipoDesglose == 'Iva'){
                                        if(tasa == 8){ //zona fronteriza
                                            regionNorte = regionNorte + impuestos;
                                        }else if(tasa == 15 || tasa == 16){
                                            if(polizasDiario[poliza].importacionBienes == true){
                                                importacion1516 = importacion1516 + impuestos;
                                            }else{
                                                iva1516 = iva1516 + importe;
                                            }
                                        }else if(tasa == 10 || tasa == 11){
                                            if(polizasDiario[poliza].importacionBienes == true){
                                                importacion1011 = importacion1011 + impuestos;
                                            }
                                        }
                                    }else if(polizasDiario[poliza].tipoDesglose == 'Retenciones'){
                                        retencion = retencion + impuestos;
                                    }
                                }
                            }
                        }
                    }
                }
   
                
   
                iva1516 = evaluar(Math.round(iva1516));
                regionNorte = evaluar(Math.round(regionNorte));
                importacion1516 = evaluar(Math.round(importacion1516));
                importacion1011 = evaluar(Math.round(importacion1011));
                importacionExento = evaluar(Math.round(importacionExento));
                iva0 = evaluar(Math.round(iva0));
                exento = evaluar(Math.round(exento));
                retencion = evaluar(Math.round(retencion));
                devoluciones = evaluar(Math.round(devoluciones));
   
                var arrayCampos = new Array();
                arrayCampos.push(iva1516,regionNorte,importacion1516,importacion1011,importacionExento,iva0,exento,retencion,devoluciones);
                var linea;
                var camposVacios = 0;
                for(var i = 0; i < arrayCampos.length; i++){
                    if(arrayCampos[i] == ''){
                        camposVacios = camposVacios + 1;
                    }
                }
                if(camposVacios < 9){
                    linea = tercero+'|'+operacion+'|'+rfc+'|'+taxid+'|'+nombreExtranjero+'|'+pais+'|'+nacionalidad+'|'+iva1516+'|||||'+regionNorte+'|||'+importacion1516+'||'+importacion1011+'||'+importacionExento+'|'+iva0+'|'+exento+'|'+retencion+'|'+devoluciones+'\n';
                }
                else{
                    linea = '';
                }
                arrayTxt.push(linea);
            }
   
            return arrayTxt;
        }catch(error){
            log.error({ title: 'Error al estructurar la información', details: error });
        }
    }

    /** Funcion que busca los distintos proveedores y tipo de operación en cada una de las transacciones */
    function buscaProveedores(facturasProv, informesGastos, polizasDiario){
        try{
            var idProv = new Array();
            if(facturasProv.length != 0){
                for(var i = 0; i < facturasProv.length; i++){
                    if(idProv.length == 0){
                        idProv.push(facturasProv[i].proveedor+facturasProv[i].tipoOperacion);
                    }else{
                        var existe = existeProveedor(idProv, facturasProv[i].proveedor+facturasProv[i].tipoOperacion);
                        if(!existe){
                            idProv.push(facturasProv[i].proveedor+facturasProv[i].tipoOperacion);
                        }
                    }
                }
            }
            if(informesGastos.length != 0){
                for(var i = 0; i < informesGastos.length; i++){
                    if(idProv.length == 0){
                        idProv.push(informesGastos[i].proveedor+informesGastos[i].tipoOperacion);
                    }else{
                        var existe = existeProveedor(idProv, informesGastos[i].proveedor+informesGastos[i].tipoOperacion);
                        if(!existe){
                            idProv.push(informesGastos[i].proveedor+informesGastos[i].tipoOperacion);
                        }
                    }
                }
                
            }
            if(polizasDiario.length != 0){
                for(var i = 0; i < polizasDiario.length; i++){
                    if(idProv.length == 0){
                        idProv.push(polizasDiario[i].proveedor+polizasDiario[i].tipoOperacion);
                    }else{
                        var existe = existeProveedor(idProv, polizasDiario[i].proveedor+polizasDiario[i].tipoOperacion);
                        if(!existe){
                            idProv.push(polizasDiario[i].proveedor+polizasDiario[i].tipoOperacion);
                        }
                    }
                }
            }
            return idProv;
        }catch(error){
            log.error({ title: 'Error en la búsqueda de proveedores', details: error });
        }
    }

     /** Función que evalua que una variable no sea 0 */
     function evaluar(variable){
         var nvoValor;
         if(variable == 0){
             nvoValor = '';
         }else{
             nvoValor = variable;
         }
         return nvoValor;
     }

    /** Función que busca que no exista el proveedor en una lista de proveedores */
    function existeProveedor(proveedores, proveedor){
        var existe = false;
        for(var x = 0; x < proveedores.length; x++){
            if(proveedor== proveedores[x]){
                existe = true;
            }
        }
        return existe;
    }

     /** Funcion que busca que no exista el error para no repetirlos */
     function buscarError(error, arrayErrores){
         var errorFlag = false;
         for (var x = 0; x < arrayErrores.length; x++){
             if (error == arrayErrores[x]){
                 errorFlag = true;
             }
         }
         return errorFlag;
     }

    /** Funcion para obtener el dato de acuerdo a la palabra clave */
    function getData (dato, subsidiaria, periodo, fecha){
        try {
            var data;
            switch (dato) {
                case 'SUBSIDIARIA':
                    data = subsidiaria;
                    break;
                case 'PERIODO':
                    data = periodo;
                    break;
                case 'DD':
                    data = fecha.getDate();
                    break;
                case 'MM':
                    data = fecha.getMonth() + 1;
                    break;
                case 'YYYY':
                    data = fecha.getFullYear();
                    break;
                case 'HH':
                    data = moment().zone("-06:00").format('HH');
                    break;
                case 'MIN':
                    data = fecha.getMinutes();
                    break;
                case 'SS':
                    data = fecha.getSeconds();
                    break;
                default:
                    break;
            }
            return data;
        } catch (error) {
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                    [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                }
            });
            log.error({ title: 'Error al obtener el nombre del archivo', details: error });
        }
    }

    /** Funcion para crear una carpeta dentro de la carpeta raíz*/
    function createFolder(nombreSubsidiaria, nombrePeriodo, tipoGuardado, idPadre){
        try {
            var nombreFolder = '';
            var folderId;
            var folder;
    
            if(tipoGuardado == 1) { //guardado por subsidiarias
                nombreFolder = nombreSubsidiaria;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe
                    folder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{ //si no existe, se crea una carpeta con el nombre de la subsidiaria
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }else if(tipoGuardado == 2) { //guardado por periodo
                nombreFolder = nombrePeriodo;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe
                    folder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{ //si no existe, se crea una carpeta con el nombre del periodo
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }else { //guardado por subsidiaria y periodo
                nombreFolder = nombreSubsidiaria;
                var nombreSubfolder = nombrePeriodo;
                var folderSubId;
                folder = searchFolderInPath(nombreFolder, idPadre);
                if(folder.runPaged().count != 0){ //existe folder subsidiaria
                folder.run().each(function(result){
                    folderSubId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                    return true;
                });
                }else{ //se crea folder subsidiaria
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreFolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: idPadre
                    });
                    folderSubId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
                log.debug('Folder', folderSubId);
                //se busca el folder periodo dentro del folder subsidiaria
                var subfolder = searchFolderInPath(nombreSubfolder, folderSubId);
                if(subfolder.runPaged().count != 0){ //existe folder periodo
                    subfolder.run().each(function(result){
                        folderId = result.getValue({ name: RECORD_INFO.FOLDER_RECORD.FIELDS.ID });
                        return true;
                    });
                }else{ //se crea folder periodo
                    var objRecord = record.create({
                        type: record.Type.FOLDER,
                        isDynamic: true
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,
                        value: nombreSubfolder
                    });
                    objRecord.setValue({
                        fieldId: RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT,
                        value: folderSubId
                    });
                    folderId = objRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                }
            }
            return folderId;
        } catch (error) {
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                    [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                }
            });
            log.error({ title: 'Error al crear las carpetas de guardado', details: error });
        }
    }

    /**
     * Funcion para ver si una carpeta ya existe
     */
    function searchFolder(nombreFolder){
        try {
            var folderSearchObj = search.create({
                type: RECORD_INFO.FOLDER_RECORD.ID,
                filters:
                [
                [RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,search.Operator.IS,nombreFolder]
                ],
                columns:
                [
                    RECORD_INFO.FOLDER_RECORD.FIELDS.ID,
                    RECORD_INFO.FOLDER_RECORD.FIELDS.NAME
                ]
            });
            return folderSearchObj;
        } catch (error) {
            log.error({ title: 'Error al buscar el folder raíz', details: error });
        }
    }

    /**
     * Funcion para ver si la carpeta subsidiaria o periodo ya existe dentro de la carpeta raíz
     */
    function searchFolderInPath(nombreFolder, carpetaRaiz){
        try {
            var folderSearchObj = search.create({
                type: RECORD_INFO.FOLDER_RECORD.ID,
                filters:
                [
                [RECORD_INFO.FOLDER_RECORD.FIELDS.NAME,search.Operator.IS,nombreFolder],
                "AND",
                [RECORD_INFO.FOLDER_RECORD.FIELDS.PARENT, search.Operator.IS, carpetaRaiz]
                ],
                columns:
                [
                    RECORD_INFO.FOLDER_RECORD.FIELDS.ID,
                    RECORD_INFO.FOLDER_RECORD.FIELDS.NAME
                ]
            });
            return folderSearchObj;
        } catch (error) {
            log.error({ title: 'Error en la búsqueda de carpetas en el folder raíz', details: error });
        }
    }

     /**
      * Funcion que hace una búsqueda de devoluciones o bonificaciones en base a un arreglo de proveedores e id de facturas
      */
     function searchFacturasCredito(proveedores, idFacturas, suitetax){
        if(suitetax){
            try{
                var credito = [];
                var creditSearch = search.create({
                    type: RECORD_INFO.VENDOR_CREDIT_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendCred"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"],
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"],
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.MAINLINE,search.Operator.IS,"T"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.PROVEEDOR,search.Operator.ANYOF,proveedores], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.TRANSACTION,search.Operator.ANYOF,idFacturas]
                    ],
                    columns:
                    [
                        RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                        RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ENTITY,
                        RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TOTAL,
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                            join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION
                        })
                    ]
                });
    
                creditSearch.run().each(function(result){
    
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ENTITY });
                    var idFactura = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION });
                    var impuesto = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TOTAL });
                    
                    credito.push({
                        idFactura: idFactura,
                        proveedor: proveedor,
                        impuesto: impuesto
                    });
    
                    return true;
                    
                });
                
                return credito;
            }catch(error){
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en crédito de facturas', details: error });
            }
        }else{
            try{
                var credito = [];
                var creditSearch = search.create({
                    type: RECORD_INFO.VENDOR_CREDIT_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendCred"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"],
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"],
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.MAINLINE,search.Operator.IS,"T"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.PROVEEDOR,search.Operator.ANYOF,proveedores], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.TRANSACTION,search.Operator.ANYOF,idFacturas]
                    ],
                    columns:
                    [
                        RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                           join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                            join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION
                        }),
                        RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TOTAL
                    ]
                });
                creditSearch.run().each(function(result){
                    
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.PROVEEDOR });
                    var idFactura = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION });
                    var impuesto = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TOTAL });
                    
                    credito.push({
                        idFactura: idFactura,
                        proveedor: proveedor,
                        impuesto: impuesto
                    });

                    return true;
    
                });
                
                return credito; 
            }catch(error){
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en crédito de facturas', details: error });
            }
        }
    }
     
     /**
      * Funcion para buscar las facturas de proveedores
      */
     function searchVendorBill(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones){
        if (suitetax) {
            try{

                // cuando el motor es suite tax
                var facturas = [];
                var facturaSearch = search.create({
                    type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendBill"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"VendBill:B"], //,"VendBill:A" para pruebas
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,"abs",periodo], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.FILTER.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ENTITY,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_BASIS,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                            name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE,
                            join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL,
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR,
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.RFC,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ID,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NOMBRE_EXTRANJERO,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PAIS_RESIDENCIA,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NACIONALIDAD,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        })
                    ]
                });

                var arrayProv = new Array();
                var arrayFactId = new Array();
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var nombreProv = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ENTITY, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = getOperacion(operacion);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_BASIS, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var taxCode = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var tipoImpuesto = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var tasa = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var rfc = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.RFC, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var taxID = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var nombreExtranjero = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NOMBRE_EXTRANJERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var paisText = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PAIS_RESIDENCIA, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var nacionalidad = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NACIONALIDAD, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                    var errores = '', paisResidencia;

                    /* Si esta lleno el campo de paisText vamos a obtener el prefijo. 
                        Ej: AR - Argentina
                            Obtenemos el AR */
                    if(paisText.length != 0){
                        var pais = paisText.split(' ',1);
                        pais = pais.toString();
                        paisResidencia = pais;
                    }else {
                        paisResidencia = "";
                    }

                    if (tipoTer == 1){ //si es proveedor nacional -> RFC obligatorio
                        if(rfc == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el RFC/";
                        }
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    } else if (tipoTer == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                        if(taxID == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal/";
                        }
                        /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                        if (nombreExtranjero != ""  && paisResidencia == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el pais de residencia/";
                        }
                        if(nombreExtranjero != "" && nacionalidad == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignada la nacionalidad/";
                        }
                        /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                        if(nombreExtranjero == ""){ 
                            paisResidencia = "";
                            nacionalidad = "";
                        }
                    } else { //si es proveedor global -> RFC NO obligatorio
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        rfc = "";
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    }
    
                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);

                    //Se realiza un arreglo de proveedores e id de facturas no repetidos
                    var credito = '';
                    if(arrayProv.length != 0){
                        var existeProv = false;
                        for(var i = 0; i < arrayProv.length; i++){
                            if(proveedor == arrayProv[i]){
                                existeProv = true;
                            }
                        }
                        if(!existeProv){
                            arrayProv.push(proveedor);
                        }
                    }else{
                        arrayProv.push(proveedor);
                    }

                    if(arrayFactId.length != 0){
                        var existeId = false;
                        for(var i = 0; i < arrayFactId.length; i++){
                            if(id == arrayFactId[i]){
                                existeId = true;
                            }
                        }
                        if(!existeId){
                            arrayFactId.push(id);
                        }
                    }else{
                        arrayFactId.push(id);
                    }
                    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoImpuesto: tipoImpuesto,
                        tipoDesglose: tipoDesglose,
                        exportacionBienes: exportacionBienes,
                        credito: credito,
                        rfc: rfc,
                        taxID: taxID,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });
    
                    return true;
                });

                var resFact = [];
                resFact.push({
                    facturas: facturas,
                    arrayProv: arrayProv,
                    arrayFactId: arrayFactId
                });
    
                return resFact;
                
            }catch(error){
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en la búsqueda de facturas', details: error });
            }
        } else {
            // cuando el motor es legacy
            try{

                var facturas = [];
                var facturaSearch = search.create({
                    type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendBill"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"VendBill:B"],
                        // "AND", 
                        // ["account",search.Operator.ANYOF,"186"],  
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.FILTER.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,"abs",periodo],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria],
                        "AND", 
                        [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR,
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ENTITY,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM
                        }),
                        RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR,
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.RFC,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ID,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NOMBRE_EXTRANJERO,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PAIS_RESIDENCIA,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NACIONALIDAD,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                        })
                    ]
                });

                // var searchResultCount = facturaSearch.runPaged().count;
                // log.debug('Facturas', searchResultCount);

                var arrayProv = new Array();
                var arrayFactId = new Array();

                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var nombreProv = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ENTITY, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = getOperacion(operacion);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM });
                    var rfc = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.RFC, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var taxID = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var nombreExtranjero = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NOMBRE_EXTRANJERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var paisText = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PAIS_RESIDENCIA, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var nacionalidad = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NACIONALIDAD, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                    var tasa = 0, errores = '', paisResidencia;
                    
                    if(paisText.length != 0){
                        var pais = paisText.split(' ',1);
                        pais = pais.toString();
                        paisResidencia = pais;
                    }else {
                        paisResidencia = "";
                    }

                    if (tipoTer == 1){ //si es proveedor nacional -> RFC obligatorio
                        if(rfc == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el RFC/";
                        }
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    } else if (tipoTer == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                        if(taxID == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal/";
                        }
                        /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                        if (nombreExtranjero != ""  && paisResidencia == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el pais de residencia/";
                        }
                        if(nombreExtranjero != "" && nacionalidad == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignada la nacionalidad/";
                        }
                        /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                        if(nombreExtranjero == ""){ 
                            paisResidencia = "";
                            nacionalidad = "";
                        }
                    } else { //si es proveedor global -> RFC NO obligatorio
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        rfc = "";
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    }

                    //se obtiene la tasa de acuerdo al código de impuesto perteneciente
                    for(var i = 0; i < valores.length; i++){
                        if(valores[i].codeName == taxCode){
                            tasa = valores[i].taxRate;
                        }
                    }

                    //se busca el tipo de desglose de acuerdo al código de impuesto
                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);

                    //Realiza la búsqueda después de agrupar para no repetir id y proveedor
                    var credito = '';
                    if(arrayProv.length != 0){
                        var existeProv = false;
                        for(var i = 0; i < arrayProv.length; i++){
                            if(proveedor == arrayProv[i]){
                                existeProv = true;
                            }
                        }
                        if(!existeProv){
                            arrayProv.push(proveedor);
                        }
                    }else{
                        arrayProv.push(proveedor);
                    }

                    if(arrayFactId.length != 0){
                        var existeId = false;
                        for(var i = 0; i < arrayFactId.length; i++){
                            if(id == arrayFactId[i]){
                                existeId = true;
                            }
                        }
                        if(!existeId){
                            arrayFactId.push(id);
                        }
                    }else{
                        arrayFactId.push(id);
                    }

                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        exportacionBienes: exportacionBienes,
                        credito: credito,
                        rfc: rfc,
                        taxID: taxID,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });

                    return true;
                });

                var resFact = [];
                resFact.push({
                    facturas: facturas,
                    arrayProv: arrayProv,
                    arrayFactId: arrayFactId
                });
                
                return resFact;
                
            }catch(error){
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en la búsqueda de facturas', details: error });
            }
        }
    }

    function searchVendorBillPrueba(subsidiaria, periodo, search_factura, suitetax, valores, exentos, iva, retenciones, recordID){
        try{

            var facturas = [];
            //cargar búsqueda
            var facturaSearch = search.load({
                id: search_factura
            });

            //agregar filtros de periodo y subsidiaria
            facturaSearch.filters.push(search.createFilter({
                name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,
                operator: 'abs',
                values: periodo
            }));
            facturaSearch.filters.push(search.createFilter({
                name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.SUBSIDIARY,
                operator: search.Operator.ANYOF,
                values: subsidiaria
            }));
            log.audit({title: 'facturaSearch', details: facturaSearch });

            if(suitetax){
                var arrayProv = new Array();
                var arrayFactId = new Array();
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var nombreProv = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ENTITY, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = getOperacion(operacion);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_BASIS, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var taxCode = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var tipoImpuesto = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var tasa = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                    var rfc = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.RFC, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var taxID = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var nombreExtranjero = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NOMBRE_EXTRANJERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var paisText = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PAIS_RESIDENCIA, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var nacionalidad = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NACIONALIDAD, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                    var errores = '', paisResidencia;

                    /* Si esta lleno el campo de paisText vamos a obtener el prefijo. 
                        Ej: AR - Argentina
                            Obtenemos el AR */
                    if(paisText.length != 0){
                        var pais = paisText.split(' ',1);
                        pais = pais.toString();
                        paisResidencia = pais;
                    }else {
                        paisResidencia = "";
                    }

                    if (tipoTer == 1){ //si es proveedor nacional -> RFC obligatorio
                        if(rfc == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el RFC/";
                        }
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    } else if (tipoTer == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                        if(taxID == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal/";
                        }
                        /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                        if (nombreExtranjero != ""  && paisResidencia == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el pais de residencia/";
                        }
                        if(nombreExtranjero != "" && nacionalidad == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignada la nacionalidad/";
                        }
                        /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                        if(nombreExtranjero == ""){ 
                            paisResidencia = "";
                            nacionalidad = "";
                        }
                    } else { //si es proveedor global -> RFC NO obligatorio
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        rfc = "";
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    }
    
                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);

                    //Se realiza un arreglo de proveedores e id de facturas no repetidos
                    var credito = '';
                    if(arrayProv.length != 0){
                        var existeProv = false;
                        for(var i = 0; i < arrayProv.length; i++){
                            if(proveedor == arrayProv[i]){
                                existeProv = true;
                            }
                        }
                        if(!existeProv){
                            arrayProv.push(proveedor);
                        }
                    }else{
                        arrayProv.push(proveedor);
                    }

                    if(arrayFactId.length != 0){
                        var existeId = false;
                        for(var i = 0; i < arrayFactId.length; i++){
                            if(id == arrayFactId[i]){
                                existeId = true;
                            }
                        }
                        if(!existeId){
                            arrayFactId.push(id);
                        }
                    }else{
                        arrayFactId.push(id);
                    }
                    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoImpuesto: tipoImpuesto,
                        tipoDesglose: tipoDesglose,
                        exportacionBienes: exportacionBienes,
                        credito: credito,
                        rfc: rfc,
                        taxID: taxID,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });
    
                    return true;
                });

                var resFact = [];
                resFact.push({
                    facturas: facturas,
                    arrayProv: arrayProv,
                    arrayFactId: arrayFactId
                });
    
                return resFact;
            }else{
                var arrayProv = new Array();
                var arrayFactId = new Array();
    
                facturaSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var nombreProv = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ENTITY, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = getOperacion(operacion);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM });
                    var rfc = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.RFC, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var taxID = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var nombreExtranjero = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NOMBRE_EXTRANJERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var paisText = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PAIS_RESIDENCIA, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var nacionalidad = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NACIONALIDAD, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR});
                    var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                    var tasa = 0, errores = '', paisResidencia;
                    
                    if(paisText.length != 0){
                        var pais = paisText.split(' ',1);
                        pais = pais.toString();
                        paisResidencia = pais;
                    }else {
                        paisResidencia = "";
                    }
    
                    if (tipoTer == 1){ //si es proveedor nacional -> RFC obligatorio
                        if(rfc == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el RFC/";
                        }
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    } else if (tipoTer == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                        if(taxID == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal/";
                        }
                        /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                        if (nombreExtranjero != ""  && paisResidencia == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el pais de residencia/";
                        }
                        if(nombreExtranjero != "" && nacionalidad == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignada la nacionalidad/";
                        }
                        /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                        if(nombreExtranjero == ""){ 
                            paisResidencia = "";
                            nacionalidad = "";
                        }
                    } else { //si es proveedor global -> RFC NO obligatorio
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        rfc = "";
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    }
    
                    //se obtiene la tasa de acuerdo al código de impuesto perteneciente
                    for(var i = 0; i < valores.length; i++){
                        if(valores[i].codeName == taxCode){
                            tasa = valores[i].taxRate;
                        }
                    }
    
                    //se busca el tipo de desglose de acuerdo al código de impuesto
                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
    
                    //Realiza la búsqueda después de agrupar para no repetir id y proveedor
                    var credito = '';
                    if(arrayProv.length != 0){
                        var existeProv = false;
                        for(var i = 0; i < arrayProv.length; i++){
                            if(proveedor == arrayProv[i]){
                                existeProv = true;
                            }
                        }
                        if(!existeProv){
                            arrayProv.push(proveedor);
                        }
                    }else{
                        arrayProv.push(proveedor);
                    }
    
                    if(arrayFactId.length != 0){
                        var existeId = false;
                        for(var i = 0; i < arrayFactId.length; i++){
                            if(id == arrayFactId[i]){
                                existeId = true;
                            }
                        }
                        if(!existeId){
                            arrayFactId.push(id);
                        }
                    }else{
                        arrayFactId.push(id);
                    }
    
                    facturas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        exportacionBienes: exportacionBienes,
                        credito: credito,
                        rfc: rfc,
                        taxID: taxID,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });
    
                    return true;
                });
    
                var resFact = [];
                resFact.push({
                    facturas: facturas,
                    arrayProv: arrayProv,
                    arrayFactId: arrayFactId
                });
                
                return resFact;
            }
            
        }catch(error){
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                    [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                }
            });
            log.error({ title: 'Error en la búsqueda de facturas', details: error });
        }
    }
     /**
      * Funcion para buscar las facturas de proveedores para one world
      */
     function searchVendorBillOW(periodo, suitetax, valores, exentos, iva, retenciones){
         if (suitetax) {
             // cuando el motor es suite tax
             var facturas = [];
             var idPastBill = '', idPastVendor = '';
             var facturaSearch = search.create({
                 type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                 filters:
                 [
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendBill"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"VendBill:B"], //,"VendBill:A" para pruebas
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,"abs",periodo],
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.FILTER.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"]
                 ],
                 columns:
                 [
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                     search.createColumn({
                         name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                         join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                     }),
                     search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                     }),
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT,
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT,
                     search.createColumn({
                         name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE,
                         join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                     }),
                     search.createColumn({
                         name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE,
                         join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL
                     }),
                     search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL,
                     }),
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR
                 ]
             });
 
             facturaSearch.run().each(function(result){
                 var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                 var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                 var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                 var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                 var tipoTercero = tercero.split(' ',1);
                 tipoTercero = tipoTercero.toString();
                 var operacion = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                 var tipoOperacion = getOperacion(operacion);
                 tipoOperacion = tipoOperacion.toString();
                 var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT });
                 var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT });
                 var taxCode = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                 var tipoImpuesto = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                 var tasa = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_DETAIL });
                 var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                 var errores = '';

                 var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                
                 //Se realiza la búsqueda de creditos de factura de acuerdo al proveedor y id de factura
                 //solo manda a buscar si es una factura diferente
                 var credito = '';
                 if((proveedor != idPastVendor) && (id != idPastBill)){
                     credito = searchVendorCredit(proveedor, id, suitetax);
                     if (credito.length == 0){
                         credito = '';
                     }
                 }else{
                     credito = '';
                 }

                 idPastBill = id;
                 idPastVendor = proveedor;
 
                 facturas.push({
                     id: id,
                     proveedor: proveedor,
                     tipoTercero: tipoTercero,
                     tipoOperacion: tipoOperacion,
                     importe: importe,
                     impuestos: impuestos,
                     taxCode: taxCode,
                     tasa: tasa,
                     tipoImpuesto: tipoImpuesto,
                     tipoDesglose: tipoDesglose,
                     exportacionBienes: exportacionBienes,
                     credito: credito
                 });

                 return true;
             });

             return facturas;

         } else {
             // cuando el motor es legacy
             var facturas = [];
             var idPastBill = '', idPastVendor = '';
             var facturaSearch = search.create({
                 type: RECORD_INFO.VENDOR_BILL_RECORD.ID,
                 filters:
                 [
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendBill"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"],
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"VendBill:B"],
                     // "AND", 
                     // ["account",search.Operator.ANYOF,"186"],  
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.FILTER.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.PERIOD,"abs",periodo],
                     "AND", 
                     [RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                 ],
                 columns:
                 [
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                     "type",
                     search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR,
                     }),
                     search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR
                     }),
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION,
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT,
                     search.createColumn({
                        name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME,
                        join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM
                     }),
                     RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR
                 ]
             });
 
             facturaSearch.run().each(function(result){
                 var id = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID });
                 var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                 var tipoTer = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                 var tercero = result.getText({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.VENDOR });
                 var tipoTercero = tercero.split(' ',1);
                 tipoTercero = tipoTercero.toString();
                 var operacion = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TIPO_OPERACION });
                 var tipoOperacion = getOperacion(operacion);
                 tipoOperacion = tipoOperacion.toString();
                 var importe = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                 var impuestos = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_AMOUNT });
                 var taxCode = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.NAME, join: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.TAX_ITEM });
                 var exportacionBienes = result.getValue({ name: RECORD_INFO.VENDOR_BILL_RECORD.FIELDS.COMERCIO_EXTERIOR });
                 var tasa = 0, errores = '';
 
                 for(var i = 0; i < valores.length; i++){
                     if(valores[i].codeName == taxCode){
                         tasa = valores[i].taxRate;
                     }
                 }

                 var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
 
                 //Realizar la búsqueda después de agrupar
                 var credito = '';
                 if((proveedor != idPastVendor) && (id != idPastBill)){
                     credito = searchVendorCredit(proveedor, id, suitetax);
                     if (credito.length == 0){
                         credito = '';
                     }
                 }else{
                     credito = '';
                 }

                 idPastBill = id;
                 idPastVendor = proveedor;
 
                 facturas.push({
                     id: id,
                     proveedor: proveedor,
                     tipoTercero: tipoTercero,
                     tipoOperacion: tipoOperacion,
                     importe: importe,
                     impuestos: impuestos,
                     taxCode: taxCode,
                     tasa: tasa,
                     tipoDesglose: tipoDesglose,
                     exportacionBienes: exportacionBienes,
                     credito: credito
                 });
 
                 return true;
             });
             return facturas;
             
         }
     }

     /**
      * Funcion para buscar los informes de gastos
      */
     function searchExpenseReports(subsidiaria, periodo, suitetax, valores, exentos, iva, retenciones){
        if(suitetax){
            try {
                var informes = [];
                var informesSearch = search.create({
                    type: RECORD_INFO.EXPENSE_REPORT_RECORD.ID,
                    filters:
                    [
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"ExpRept"], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"],
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"ExpRept:I"], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PERIOD,"abs",periodo], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"],
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR,
                    search.createColumn({
                        name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ENTITY,
                        join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                    }),
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                        name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE,
                        join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                        name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_TYPE,
                        join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        search.createColumn({
                        name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_RATE,
                        join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                        }),
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION,
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.RFC,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_ID,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NOMBRE_EXTRANJERO,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PAIS_RESIDENCIA,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NACIONALIDAD,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        })
                    ],
                });
    
                informesSearch.run().each(function(result){
    
                    var id = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var nombreProv = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ENTITY, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = getOperacion(operacion);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT });
                    var impuestos = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var tipoImpuesto = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var rfc = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.RFC, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var taxID = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_ID, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var nombreExtranjero = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NOMBRE_EXTRANJERO, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var paisText = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PAIS_RESIDENCIA, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var nacionalidad = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NACIONALIDAD, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var importacionBienes = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION });
                    var tasa = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                    var errores = '';
    
                    if(paisText.length != 0){
                        var pais = paisText.split(' ',1);
                        pais = pais.toString();
                        paisResidencia = pais;
                    }else {
                        paisResidencia = "";
                    }
    
                    if (tipoTer == 1){ //si es proveedor nacional -> RFC obligatorio
                        if(rfc == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el RFC/";
                        }
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    } else if (tipoTer == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                        if(taxID == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal/";
                        }
                        /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                        if (nombreExtranjero != ""  && paisResidencia == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el pais de residencia/";
                        }
                        if(nombreExtranjero != "" && nacionalidad == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignada la nacionalidad/";
                        }
                        /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                        if(nombreExtranjero == ""){ 
                            paisResidencia = "";
                            nacionalidad = "";
                        }
                    } else { //si es proveedor global -> RFC NO obligatorio
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        rfc = "";
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    }
    
                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoImpuesto: tipoImpuesto,
                        tipoDesglose: tipoDesglose,
                        importacionBienes: importacionBienes,
                        rfc: rfc,
                        taxID: taxID,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });
    
                    return true;
                });
    
                return informes;     
            } catch (error) {
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en la búsqueda de informes', details: error });
            }
        } else {
            try {
                
                var informes = [];
                var informesSearch = search.create({
                    type: RECORD_INFO.EXPENSE_REPORT_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"ExpRept"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.MAINLINE,search.Operator.ANY,""], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"ExpRept:I"],
                        // "AND", 
                        // ["account",search.Operator.ANYOF,"186"],   
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"2","1","3"],
                        "AND",
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PERIOD,"abs",periodo], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                        "AND", 
                        [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR,
                        search.createColumn({
                            name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ENTITY,
                            join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE,
                        RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION,
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.RFC,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_ID,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NOMBRE_EXTRANJERO,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PAIS_RESIDENCIA,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NACIONALIDAD,
                           join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        })
                    ]
                });
    
                // var searchResultCount = informesSearch.runPaged().count;
                // log.debug('Informes', searchResultCount);
    
                informesSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var nombreProv = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ENTITY, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = getOperacion(operacion);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE });
                    var rfc = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.RFC, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var taxID = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_ID, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var nombreExtranjero = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NOMBRE_EXTRANJERO, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var paisText = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PAIS_RESIDENCIA, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var nacionalidad = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NACIONALIDAD, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR});
                    var importacionBienes = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION });
                    var tasa = 0, errores = '';

                    if(paisText.length != 0){
                        var pais = paisText.split(' ',1);
                        pais = pais.toString();
                        paisResidencia = pais;
                    }else {
                        paisResidencia = "";
                    }

                    if (tipoTer == 1){ //si es proveedor nacional -> RFC obligatorio
                        if(rfc == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el RFC/";
                        }
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    } else if (tipoTer == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                        if(taxID == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal/";
                        }
                        /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                        if (nombreExtranjero != ""  && paisResidencia == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el pais de residencia/";
                        }
                        if(nombreExtranjero != "" && nacionalidad == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignada la nacionalidad/";
                        }
                        /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                        if(nombreExtranjero == ""){ 
                            paisResidencia = "";
                            nacionalidad = "";
                        }
                    } else { //si es proveedor global -> RFC NO obligatorio
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        rfc = "";
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    }
    
                    for(var i = 0; i < valores.length; i++){
                        if(valores[i].codeName == taxCode){
                            tasa = valores[i].taxRate;
                        }
                    }
    
                    var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
    
                    informes.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        importacionBienes: importacionBienes,
                        rfc: rfc,
                        taxID: taxID,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });
    
                    return true;
                });
    
                return informes;
            } catch (error) {
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en la búsqueda de informes', details: error });
            }
        }
    }

      /**
      * Funcion para buscar los informes de gastos
      */
     function searchExpenseReportsOW(periodo, suitetax, valores, exentos, iva, retenciones){

         if(suitetax){   
             var informes = [];
             var informesSearch = search.create({
                 type: RECORD_INFO.EXPENSE_REPORT_RECORD.ID,
                 filters:
                 [
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"ExpRept"], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"],
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"ExpRept:I"], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PERIOD,"abs",periodo],
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"],
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                    "AND", 
                    [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"]
                 ],
                 columns:
                 [
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT,
                    RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT,
                     search.createColumn({
                       name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE,
                       join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                     }),
                     search.createColumn({
                       name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_TYPE,
                       join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                     }),
                     search.createColumn({
                        name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_RATE,
                        join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL
                     }),
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION
                 ],
             });

             informesSearch.run().each(function(result){

                 var id = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID });
                 var proveedor = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                 var tipoTer = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                 var tercero = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                 var tipoTercero = tercero.split(' ',1);
                 tipoTercero = tipoTercero.toString();
                 var operacion = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION });
                 var tipoOperacion = getOperacion(operacion);
                 tipoOperacion = tipoOperacion.toString();
                 var importe = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT });
                 var impuestos = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT });
                 var taxCode = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                 var tipoImpuesto = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                 var importacionBienes = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION });
                 var tasa = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_DETAIL });
                 var errores = ''; 

                 var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
 
                 informes.push({
                     id: id,
                     proveedor: proveedor,
                     tipoTercero: tipoTercero,
                     tipoOperacion: tipoOperacion,
                     importe: importe,
                     impuestos: impuestos,
                     taxCode: taxCode,
                     tasa: tasa,
                     tipoImpuesto: tipoImpuesto,
                     tipoDesglose: tipoDesglose,
                     importacionBienes: importacionBienes
                 });

                 return true;
             });
 
             return informes;     
         } else {
             var informes = [];
             var informesSearch = search.create({
                 type: RECORD_INFO.EXPENSE_REPORT_RECORD.ID,
                 filters:
                 [
                     [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"ExpRept"], 
                     "AND", 
                     [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                     "AND", 
                     [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.MAINLINE,search.Operator.ANY,""], 
                     "AND", 
                     [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"ExpRept:I"],
                     // "AND", 
                     // ["account",search.Operator.ANYOF,"186"],   
                     "AND", 
                     [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"2","1","3"],
                     "AND",
                     [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                     "AND", 
                     [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PERIOD,"abs",periodo],
                     "AND", 
                     [RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                 ],
                 columns:
                 [
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID,
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION,
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO,
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR,
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT,
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE,
                     RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION
                 ]
             });
             informesSearch.run().each(function(result){
                 var id = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ID });
                 var proveedor = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                 var tipoTer = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                 var tercero = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_TERCERO });
                 var tipoTercero = tercero.split(' ',1);
                 tipoTercero = tipoTercero.toString();
                 var operacion = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TIPO_OPERACION });
                 var tipoOperacion = getOperacion(operacion);
                 tipoOperacion = tipoOperacion.toString();
                 var importe = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                 var impuestos = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_AMOUNT });
                 var taxCode = result.getText({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.TAX_CODE });
                 var importacionBienes = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.IMPORTACION });
                 var tasa = 0, errores = '';

                 for(var i = 0; i < valores.length; i++){
                     if(valores[i].codeName == taxCode){
                         tasa = valores[i].taxRate;
                     }
                 }

                 var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
 
                 informes.push({
                     id: id,
                     proveedor: proveedor,
                     tipoTercero: tipoTercero,
                     tipoOperacion: tipoOperacion,
                     importe: importe,
                     impuestos: impuestos,
                     taxCode: taxCode,
                     tasa: tasa,
                     tipoDesglose: tipoDesglose,
                     importacionBienes: importacionBienes
                 });
 
                 return true;
             });
 
             return informes;
         }
     }

    /**
     * Funcion para buscar las polizas de diario
     */
    function searchDailyPolicy(subsidiaria, periodo, suitetax, valCodigos, exentos, iva, retenciones){

        if(suitetax){
            try {
                var polizas = []
                var polizasSearch = search.create({
                    type: RECORD_INFO.JOURNAL_ENTRY_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"Journal"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"Journal:B"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PERIOD,"abs",periodo], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"]
                    ],
                    columns:
                    [
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR,
                        search.createColumn({
                            name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ENTITY,
                            join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_TOTAL,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION,
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.RFC,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ID,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NOMBRE_EXTRANJERO,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PAIS_RESIDENCIA,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NACIONALIDAD,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        })
                    ]
                });
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                    var nombreProv = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ENTITY, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                    var tipoTer = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = getOperacion(operacion);
                    tipoOperacion = tipoOperacion.toString();
                    var rfc = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.RFC, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var taxID = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ID, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var nombreExtranjero = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NOMBRE_EXTRANJERO, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var paisText = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PAIS_RESIDENCIA, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var nacionalidad = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NACIONALIDAD, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var importacionBienes = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION });
                    var cuenta = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT });
                    var importe = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT }); //importe negativo = crédito, importe positivo = débito
                    var impuestos = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_TOTAL });
                    var tasa = 0, errores = '',  codigos = [];
    
                    if(paisText.length != 0){
                        var pais = paisText.split(' ',1);
                        pais = pais.toString();
                        paisResidencia = pais;
                    }else {
                        paisResidencia = "";
                    }
    
                    if (tipoTer == 1){ //si es proveedor nacional -> RFC obligatorio
                        if(rfc == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el RFC/";
                        }
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    } else if (tipoTer == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                        if(taxID == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal/";
                        }
                        /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                        if (nombreExtranjero != ""  && paisResidencia == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el pais de residencia/";
                        }
                        if(nombreExtranjero != "" && nacionalidad == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignada la nacionalidad/";
                        }
                        /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                        if(nombreExtranjero == ""){ 
                            paisResidencia = "";
                            nacionalidad = "";
                        }
                    } else { //si es proveedor global -> RFC NO obligatorio
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        rfc = "";
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    }

                    //Se busca el código y tasa de impuesto en base a la cuenta
                    for(var i = 0; i < valCodigos.length; i++){
                        if(valCodigos[i].cuenta1 == cuenta || valCodigos[i].cuenta2 == cuenta){
                            var taxCodeCod = valCodigos[i].codeName;
                            var tasaCod = valCodigos[i].taxRate;
                            var tipoDesgloseCod = buscaDesgloseImpuesto(taxCodeCod, exentos, iva, retenciones);

                            codigos.push({
                                taxCode: taxCodeCod,
                                tasa: tasaCod,
                                tipoDesglose: tipoDesgloseCod
                            });
                        }
                    }
    
                    //Si la cuenta no tiene un código y/o tipo de impuesto asociado, no se toma en cuenta
                    if(codigos.length != 0){
        
                        polizas.push({
                            id: id,
                            proveedor: proveedor,
                            tipoTercero: tipoTercero,
                            tipoOperacion: tipoOperacion,
                            importacionBienes: importacionBienes,
                            cuenta: cuenta,
                            importe: importe,
                            impuestos: impuestos,
                            codigos: codigos,
                            rfc: rfc,
                            taxID: taxID,
                            nombreExtranjero: nombreExtranjero,
                            paisResidencia: paisResidencia,
                            nacionalidad: nacionalidad,
                            errores: errores
                        });
                    }
                    return true;
                });
    
                return polizas;
            } catch (error) {
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en la búsqueda de polizas', details: error });
            }
        }else {
            try{

                var polizas = []
                var polizasSearch = search.create({
                    type: RECORD_INFO.JOURNAL_ENTRY_RECORD.ID,
                    filters:
                    [
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"Journal"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.MAINLINE,search.Operator.ANY,""],
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"Journal:B"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PERIOD,"abs",periodo], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.SUBSIDIARY,search.Operator.ANYOF,subsidiaria], 
                        "AND", 
                        [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                    ],
                    columns:
                    [
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT,
                        search.createColumn({
                           name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME,
                           join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT
                        }),
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR,
                        search.createColumn({
                            name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ENTITY,
                            join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR
                        }),
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_AMOUNT,
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ITEM
                        }),
                        RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION,
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.RFC,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ID,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NOMBRE_EXTRANJERO,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PAIS_RESIDENCIA,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NACIONALIDAD,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR
                        })
                    ]
                });
    
                // var searchResultCount = polizasSearch.runPaged().count;
                // log.debug('Polizas', searchResultCount);
    
                polizasSearch.run().each(function(result){
                    var id = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID });
                    var proveedor = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                    var nombreProv = result.getValue({ name: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.ENTITY, join: RECORD_INFO.EXPENSE_REPORT_RECORD.FIELDS.PROVEEDOR });
                    var cuenta = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT });
                    var tipoTer = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tercero = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                    var tipoTercero = tercero.split(' ',1);
                    tipoTercero = tipoTercero.toString();
                    var operacion = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION });
                    var tipoOperacion = getOperacion(operacion);
                    tipoOperacion = tipoOperacion.toString();
                    var importe = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                    var impuestos = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_AMOUNT });
                    var taxCode = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ITEM });
                    var rfc = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.RFC, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var taxID = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ID, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var nombreExtranjero = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NOMBRE_EXTRANJERO, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var paisText = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PAIS_RESIDENCIA, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var nacionalidad = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NACIONALIDAD, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR});
                    var importacionBienes = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION });
                    var tasa = '', errores = '', tipoDesglose = '', codigos = [];

                    if(paisText.length != 0){
                        var pais = paisText.split(' ',1);
                        pais = pais.toString();
                        paisResidencia = pais;
                    }else {
                        paisResidencia = "";
                    }

                    if (tipoTer == 1){ //si es proveedor nacional -> RFC obligatorio
                        if(rfc == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el RFC/";
                        }
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    } else if (tipoTer == 2){ // si es proveedor extranjero -> RFC opcional, TaxID obligatorio, nombreExtranjero opcional
                        if(taxID == ''){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el número de ID Fiscal/";
                        }
                        /** Si tiene asignado un valor el campo nombre extranjero, se tiene que tener el pais y la nacionalidad */
                        if (nombreExtranjero != ""  && paisResidencia == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignado el pais de residencia/";
                        }
                        if(nombreExtranjero != "" && nacionalidad == ""){
                            errores = errores + "El proveedor " + nombreProv + " no tiene asignada la nacionalidad/";
                        }
                        /** Si no tiene un valor en nombre extranjero los otros campos no importan */
                        if(nombreExtranjero == ""){ 
                            paisResidencia = "";
                            nacionalidad = "";
                        }
                    } else { //si es proveedor global -> RFC NO obligatorio
                        /** Los siguientes campos son vacíos porque solo aplican para proveedores extranjeros */
                        rfc = "";
                        taxID = "";
                        nombreExtranjero = "";
                        paisResidencia = "";
                        nacionalidad = "";
                    }
    
                    //si no tiene un codigo de impuesto, se busca en base a la cuenta
                    if(taxCode == ''){
                        for(var i = 0; i < valCodigos.length; i++){
                            /* log.audit({title: 'Cuenta a comparar', details: cuenta });
                            log.audit({title: 'Cuentas de códigos', details: valCodigos[i].cuenta1 + '/' + valCodigos[i].cuenta2 }); */
                            if(valCodigos[i].cuenta1 == cuenta || valCodigos[i].cuenta2 == cuenta){
                                var taxCodeCod = valCodigos[i].codeName;
                                var tasaCod = valCodigos[i].taxRate;
                                var tipoDesgloseCod = buscaDesgloseImpuesto(taxCodeCod, exentos, iva, retenciones);

                                codigos.push({
                                    taxCode: taxCodeCod,
                                    tasa: tasaCod,
                                    tipoDesglose: tipoDesgloseCod
                                });
                            }
                        }
                    }else{ //si tiene codigo se busca la tasa y el tipo de desglose en los valores del registro
                        for(var i = 0; i < valCodigos.length; i++){
                            if(valCodigos[i].codeName == taxCode){
                                tasa = valCodigos[i].taxRate;
                            }
                        }
                        tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                        codigos = '';
                    }
    
                    polizas.push({
                        id: id,
                        proveedor: proveedor,
                        tipoTercero: tipoTercero,
                        tipoOperacion: tipoOperacion,
                        importacionBienes: importacionBienes,
                        importe: importe,
                        impuestos: impuestos,
                        taxCode: taxCode,
                        tasa: tasa,
                        tipoDesglose: tipoDesglose,
                        codigos: codigos,
                        rfc: rfc,
                        taxID: taxID,
                        nombreExtranjero: nombreExtranjero,
                        paisResidencia: paisResidencia,
                        nacionalidad: nacionalidad,
                        errores: errores
                    });
                    
                    return true;
                });
    
                return polizas;
            }catch(error){
                var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
                otherId = record.submitFields({
                    type: RECORD_INFO.DIOT_RECORD.ID,
                    id: recordID,
                    values: {
                        [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                        [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                    }
                });
                log.error({ title: 'Error en la búsqueda de polizas', details: error });
            }
        }
    }

     /**
      * Funcion para buscar las polizas de diario
      */
     function searchDailyPolicyOW(periodo, suitetax, valCodigos, exentos, iva, retenciones){

         if(suitetax){
             var polizas = []
             var polizasSearch = search.create({
                 type: RECORD_INFO.JOURNAL_ENTRY_RECORD.ID,
                 filters:
                 [
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"Journal"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"Journal:B"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PERIOD,"abs",periodo],
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"]
                 ],
                 columns:
                 [
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_TOTAL,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION
                 ]
             });
             polizasSearch.run().each(function(result){
                 var id = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID });
                 var proveedor = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                 var tipoTer = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                 var tercero = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                 var tipoTercero = tercero.split(' ',1);
                 tipoTercero = tipoTercero.toString();
                 var operacion = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION });
                 var tipoOperacion = getOperacion(operacion);
                 tipoOperacion = tipoOperacion.toString();
                 var importacionBienes = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION });
                 var cuenta = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT });
                 var importe = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT }); //importe negativo = crédito, importe positivo = débito
                 var impuestos = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_TOTAL });
                 var errores = '';

                 // Se manda llamar a la función para la búsqueda de código, tipo y tasa de impuesto
                 var codigos = searchTaxCode(suitetax, cuenta, valCodigos, exentos, iva, retenciones);

                 //Se obtiene el desglose de impuesto de acuerdo al código de impuesto
                 /* var tipoDesglose;
                 for (var i = 0; i < codigos.length; i++){
                     tipoDesglose = buscaDesgloseImpuesto(codigos[i].taxCode, exentos, iva, retenciones);
                 } */

                 //Si la cuenta no tiene un código y/o tipo de impuesto asociado, no se toma en cuenta
                 if(codigos.length != 0){
     
                     polizas.push({
                         id: id,
                         proveedor: proveedor,
                         tipoTercero: tipoTercero,
                         tipoOperacion: tipoOperacion,
                         importacionBienes: importacionBienes,
                         cuenta: cuenta,
                         importe: importe,
                         impuestos: impuestos,
                         codigos: codigos
                     });
                 }
                 return true;
             });
 
             return polizas;
         }else {
             var polizas = []
             var polizasSearch = search.create({
                 type: RECORD_INFO.JOURNAL_ENTRY_RECORD.ID,
                 filters:
                 [
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"Journal"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.MAINLINE,search.Operator.ANY,""],
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.STATUS,search.Operator.ANYOF,"Journal:B"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,search.Operator.ANYOF,"1","2","3"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,search.Operator.ANYOF,"1","2","3"], 
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PERIOD,"abs",periodo],
                     "AND", 
                     [RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"]
                 ],
                 columns:
                 [
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_AMOUNT,
                     search.createColumn({
                        name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME,
                        join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ITEM
                     }),
                     RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION
                 ]
             });
             polizasSearch.run().each(function(result){
                 var id = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ID });
                 var proveedor = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.PROVEEDOR });
                 var cuenta = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.ACCOUNT });
                 var tipoTer = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                 var tercero = result.getText({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_TERCERO });
                 var tipoTercero = tercero.split(' ',1);
                 tipoTercero = tipoTercero.toString();
                 var operacion = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TIPO_OPERACION });
                 var tipoOperacion = getOperacion(operacion);
                 tipoOperacion = tipoOperacion.toString();
                 var importe = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                 var impuestos = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_AMOUNT });
                 var taxCode = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.NAME, join: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.TAX_ITEM });
                 var importacionBienes = result.getValue({ name: RECORD_INFO.JOURNAL_ENTRY_RECORD.FIELDS.IMPORTACION });
                 var tasa = '', errores = '', tipoDesglose = '', codigos = '';

                 //si no tiene un codigo de impuesto, se busca en base a la cuenta
                 if(taxCode == ''){
                     codigos = searchTaxCode(suitetax, cuenta, valCodigos, exentos, iva, retenciones);
                 }else{
                     for(var i = 0; i < valCodigos.length; i++){
                         if(valCodigos[i].codeName == taxCode){
                             tasa = valCodigos[i].taxRate;
                         }
                     }
                     tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                 }

                 polizas.push({
                     id: id,
                     proveedor: proveedor,
                     tipoTercero: tipoTercero,
                     tipoOperacion: tipoOperacion,
                     importacionBienes: importacionBienes,
                     importe: importe,
                     impuestos: impuestos,
                     taxCode: taxCode,
                     tasa: tasa,
                     tipoDesglose: tipoDesglose,
                     codigos: codigos
                 });
                 
                 return true;
             });

             return polizas;
         }
     }

    function getOperacion(operacion){
        try {
            var tipoOperacion;
            if(operacion == OPERATION_TYPE.SERVICIOS){
                tipoOperacion = OPERATION_TYPE.SERVICIOS_VALOR;
            }else if(operacion == OPERATION_TYPE.INMUEBLES){
                tipoOperacion = OPERATION_TYPE.INMUEBLES_VALOR;
            }else if(operacion == OPERATION_TYPE.OTROS){
                tipoOperacion = OPERATION_TYPE.OTROS_VALOR;
            }
            return tipoOperacion;
        } catch (error) {
            log.error({ title: 'Error al obtener el tipo de operación', details: error });
        }
    }

     /**
      * Función que busca el desglose de impuesto de acuerdo al código de impuesto
      * @param {*} codigo Codigo de impuesto a buscar en el desglose
      * @param {*} exentos Desglose de impuestos exentos
      * @param {*} iva Desglose de impuestos con iva
      * @param {*} retenciones Desglose de impuestos con retenciones
      * @returns El nombre del impuesto al que corresponde
      */
    function buscaDesgloseImpuesto(codigo, exentos, iva, retenciones){
        try {
            var desglose = '';
            if(exentos.length != 0){
                for(var i = 0; i < exentos.length; i++){
                    if(codigo == exentos[i].text){
                        desglose = 'Exento';
                        break;
                    }
                }
            }
            if(iva.length != 0){
                for(var i = 0; i < iva.length; i++){
                    if(codigo == iva[i].text){
                        desglose = 'Iva';
                        break;
                    }
                }
            }
            if(retenciones.length != 0){
                for(var i = 0; i < retenciones.length; i++){
                    if(codigo == retenciones[i].text){
                        desglose = 'Retenciones';
                        break;
                    }
                }
            }
    
            return desglose;
        } catch (error) {
            log.error({ title: 'Error al buscar el desglose de impuesto', details: error });
        }
    }

     /**
      * Funcion que hace una búsqueda de devoluciones o bonificaciones de algún proveedor
      */
     function searchVendorCredit(proveedor, idFactProv, suitetax){
         if(suitetax){
             var credito = [], proveedorC = '', idFact = '', idC = '';
             var creditSearch = search.create({
                 type: RECORD_INFO.VENDOR_CREDIT_RECORD.ID,
                 filters:
                 [
                    [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendCred"], 
                    "AND", 
                    [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"],
                    "AND", 
                    [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                    "AND", 
                    [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.PROVEEDOR,search.Operator.ANYOF,proveedor]
                 ],
                 columns:
                 [
                    RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                    RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ENTITY,
                    RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TOTAL,
                    RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TOTAL,
                    search.createColumn({
                       name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                       join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION
                    }),
                    search.createColumn({
                       name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_CODE,
                       join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL
                    }),
                    search.createColumn({
                       name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TYPE,
                       join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL
                    }),
                    search.createColumn({
                       name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_RATE,
                       join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL
                    })
                 ]
             });

             creditSearch.run().each(function(result){

                 var id = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID });
                 var proveedor = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ENTITY });
                 var idFactura = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION });
                 var impuesto = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TOTAL });
                 var total = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TOTAL });
                 var taxCode = result.getText({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_CODE, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL });
                 var tipoImpuesto = result.getText({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_TYPE, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL });
                 var tasa = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_RATE, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_DETAIL });
                 total = -1 * (total);
                 var importe = total - impuesto;

                 if(idFactProv == idFactura || idFactProv == idFact){
                     
                     if (proveedor != '' || idFactura != ''){
                         proveedorC = proveedor;
                         idFact = idFactura;
                     }
 
                     if (idFactProv == idFact){
                         if ((idC == id) && (taxCode != '') && (tipoImpuesto != '')){
                         
                             credito.push({
                                 id: id,
                                 proveedor: proveedorC,
                                 idFactura: idFact,
                                 importe: importe,
                                 impuesto: impuesto,
                                 total: total,
                                 taxCode: taxCode,
                                 tipoImpuesto: tipoImpuesto,
                                 tasa: tasa
                             });
                         }
                     }
 
                     idC = id;
                 }

                 
                 return true;
             });
             
             return credito;
         }else{
             try{

                 var credito = [];
                 var creditSearch = search.create({
                     type: RECORD_INFO.VENDOR_CREDIT_RECORD.ID,
                     filters:
                     [
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TYPE,search.Operator.ANYOF,"VendCred"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.VOIDED,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.MAINLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAXLINE,search.Operator.IS,"F"], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.PROVEEDOR,search.Operator.ANYOF,proveedor], 
                        "AND", 
                        [RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.FILTER.TRANSACTION,search.Operator.ANYOF,idFactProv]
                     ],
                     columns:
                     [
                        RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TIPO_TERCERO,
                           join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.PROVEEDOR
                        }),
                        search.createColumn({
                           name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID,
                           join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION
                        }),
                        RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.NET_AMOUNT_NOTAX,
                        RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_AMOUNT
                     ]
                 });
                 creditSearch.run().each(function(result){
                     
                     var id = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID });
                     var tipoTercero = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TIPO_TERCERO, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.PROVEEDOR });
                     var idFactura = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.ID, join: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TRANSACTION });
                     var importe = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.NET_AMOUNT_NOTAX });
                     var impuesto = result.getValue({ name: RECORD_INFO.VENDOR_CREDIT_RECORD.FIELDS.TAX_AMOUNT });
     
                     credito.push({
                         id: id,
                         proveedor: proveedor,
                         tipoTercero: tipoTercero,
                         idFactura: idFactura,
                         importe: importe,
                         impuesto: impuesto
                     });
                     
                     return true;
                 });
                 
                 return credito; 
             }catch(error){
                 log.error({ title: 'Error en búsqueda de crédito', details: error });
             }
         }
     }

     /**
      * Función que busca el código y tipo de impuesto para las pólizas
      * @param {*} suitetax Motor (legacy o suitetax)
      * @param {*} cuenta Cuenta de la línea de póliza a comparar con las cuentas asociadas a códigos de impuesto
      * @param {*} valCodigos Registro de los códigos con tipo de impuesto y tasa
      * @returns Codigo y tipo de impuesto
      */

     /** NOTA: ELIMINAR DESPUÉS DE HACER LAS CORRECIONES EN SUITETAX */
     function searchTaxCode(suitetax, cuenta, valCodigos, exentos, iva, retenciones){
         if(suitetax){
             var codigos = [];
             var codigoSearch = search.create({
                 type: RECORD_INFO.SALES_TAX_ITEM_RECORD.ID,
                 filters:
                 [
                    [RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.COUNTRY,search.Operator.ANYOF,"MX"]
                 ],
                 columns:
                 [
                    RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.ID,
                    RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                    search.createColumn({
                       name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                       join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                    }),
                    search.createColumn({
                       name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.RECEIVABLES_ACCOUNT,
                       join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                    }),
                    search.createColumn({
                       name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.PAYABLES_ACCOUNT,
                       join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                    })
                 ]
              });
             codigoSearch.run().each(function(result){
                 var id = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.ID });
                 var taxCode = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME });
                 var tipoImpuesto = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME, join:RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE });
                 var cuenta1 = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.RECEIVABLES_ACCOUNT, join:RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE });
                 var cuenta2 = result.getValue({ name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.PAYABLES_ACCOUNT, join:RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE });
                 var tasa;

                 /** Se realiza un recorrido en el arreglo de valores y se ve si el id coincide con el código de impuesto para obtener los datos*/
                 for(var i = 0; i < valCodigos.length; i++){
                     if(valCodigos[i].codeName == taxCode){
                         tasa = valCodigos[i].taxRate;
                     }
                 }

                 var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);
                 /** Si la cuenta coincide con una de las asociadas con un código de impuestos */
                 if (cuenta == cuenta1 || cuenta == cuenta2){
                     //Se verifica que no sea iva 0 o exentos
                     if(tipoDesglose != 'Exento'){
                         if((tipoDesglose == 'Iva' && tasa != 0) || (tipoDesglose == 'Retenciones')){
                             codigos.push({
                                 id: id,
                                 taxCode: taxCode,
                                 tipoImpuesto: tipoImpuesto,
                                 tasa: tasa,
                                 tipoDesglose: tipoDesglose
                             });
                         }
                     }
                 }

                 return true;
             });
             return codigos;
         }else{
             var codigos = [];
             var codigoSearch = search.create({
                 type: "salestaxitem",
                 filters:
                 [
                    ["country","anyof","MX"]
                 ],
                 columns:
                 [
                    "internalid",
                    "name",
                    "rate",
                    "taxtype",
                    "purchaseaccount",
                    "saleaccount"
                 ]
              });
             codigoSearch.run().each(function(result){
                 var id = result.getValue({ name: 'internalid' });
                 var taxCode = result.getValue({ name: 'name' });
                 //var tasa = result.getValue({ name: 'rate' });
                 var tipoImpuesto = result.getValue({ name: 'taxtype' });
                 var cuenta1 = result.getValue({ name: 'purchaseaccount' });
                 var cuenta2 = result.getValue({ name: 'saleaccount' });
                 var tasa;

                 for(var i = 0; i < valCodigos.length; i++){
                     if(valCodigos[i].codeName == taxCode){
                         tasa = valCodigos[i].taxRate;
                     }
                 }

                 var tipoDesglose = buscaDesgloseImpuesto(taxCode, exentos, iva, retenciones);

                 if(cuenta == cuenta1 || cuenta == cuenta2){
                     //Se verifica que no sea iva 0 o exentos
                     if(tipoDesglose != 'Exento'){
                         if((tipoDesglose == 'Iva' && tasa != 0) || (tipoDesglose == 'Retenciones')){
                             codigos.push({
                                 id: id,
                                 taxCode: taxCode,
                                 tipoImpuesto: tipoImpuesto,
                                 tasa: tasa,
                                 tipoDesglose: tipoDesglose
                             });
                         }
                     }
                 }

                 return true;
             });
             
             return codigos;
         }
     }

    /**
     * Función que busca los códigos de impuesto
     * @param {*} suitetax Motor (legacy o suitetax)
     * @returns Búsqueda con todas las columnas
     */
    function searchCodigoImpuesto(suitetax){
        if(suitetax){
            try{
                var codigoSearch = search.create({
                    type: RECORD_INFO.SALES_TAX_ITEM_RECORD.ID,
                    filters:
                    [
                    [RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.COUNTRY,search.Operator.ANYOF,"MX"]
                    ],
                    columns:
                    [
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.ID,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                        search.createColumn({
                            name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                            join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                        }),
                        search.createColumn({
                            name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.RECEIVABLES_ACCOUNT,
                            join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                        }),
                        search.createColumn({
                            name: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.PAYABLES_ACCOUNT,
                            join: RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE
                        })
                    ]
                });
                return codigoSearch;
            }catch(error){
                log.error({ title: 'Error en la búsqueda de código de impuestos', details: error });
            }
        }else{
            try {
                var codigoSearch = search.create({
                    type: RECORD_INFO.SALES_TAX_ITEM_RECORD.ID,
                    filters:
                    [
                    [RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.COUNTRY,search.Operator.ANYOF,"MX"]
                    ],
                    columns:
                    [
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.ID,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.NAME,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.RATE,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.TAX_TYPE,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.PURCHASE_ACCOUNT,
                        RECORD_INFO.SALES_TAX_ITEM_RECORD.FIELDS.SALE_ACCOUNT
                    ]
                });
                return codigoSearch;
            } catch (error) {
                log.error({ title: 'Error en la búsqueda de código de impuestos', details: error });
            }
        }
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
        try {
            /* log.debug('Summary Time', summaryContext.seconds);
            log.debug('Summary Usage', summaryContext.usage);
            log.debug('Summary Yields', summaryContext.yields);

            log.debug('Input Summary', summaryContext.inputSummary);
            log.debug('Map Summary', summaryContext.mapSummary);
            log.debug('Reduce Summary', summaryContext.reduceSummary); */

            /** Cuando ya termine, enviar correo notificando al usuario */
            var objScript = runtime.getCurrentScript();
            var notificar = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.NOTIFICAR });
            log.debug('Notificar', notificar);
            // se obtiene el correo del usuario que ejecuto
            var userObj = runtime.getCurrentUser();
            log.debug('Current user email: ' , userObj.email);

            if(notificar){
                email.send({
                    author: userObj.id,
                    recipients: userObj.email,
                    subject: 'DIOT',
                    body: 'El proceso de la DIOT ha terminado',
                });
            }
        } catch (error) {
            var recordID = objScript.getParameter({ name: SCRIPTS_INFO.MAP_REDUCE.PARAMETERS.RECORD_DIOT_ID });
            otherId = record.submitFields({
                type: RECORD_INFO.DIOT_RECORD.ID,
                id: recordID,
                values: {
                    [RECORD_INFO.DIOT_RECORD.FIELDS.STATUS]: STATUS_LIST_DIOT.ERROR,
                    [RECORD_INFO.DIOT_RECORD.FIELDS.ERROR]: error.message
                }
            });
            log.error({ title: 'Error en el envío de correo', details: error })
        }
    }


    return {getInputData, map, reduce, summarize};

});
