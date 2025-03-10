(function (module) {
    mifosX.services = _.extend(module, {
        AuthenticationService: function (scope, httpService, SECURITY, OAUTH_REALM, OAUTH_JWT_SERVER_URL, OAUTH_JWT_CLIENT_ID, FINERACT_BASE_URL, OAUTH_JWT_CLIENT_SECRET, localStorageService,timeout, webStorage) {
            var userData = null;
            var twoFactorIsRememberMeRequest = false;
            var twoFactorAccessToken = null;

            var onLoginSuccess = function (response) {
                var data = response.data;
                if(data.isTwoFactorAuthenticationRequired != null && data.isTwoFactorAuthenticationRequired == true) {
                    if(hasValidTwoFactorToken(data.username)) {
                        var token = getTokenFromStorage(data.username);
                        onTwoFactorRememberMe(data, token);
                    } else {
                        userData = data;
                        scope.$broadcast("UserAuthenticationTwoFactorRequired", data);
                    }
                } else {
                    scope.$broadcast("UserAuthenticationSuccessEvent", data);
                    localStorageService.addToLocalStorage('userData', data);
                }
            };

            var onLoginFailure = function (response) {
                var data = response.data;
                var status = response.status;
                scope.$broadcast("UserAuthenticationFailureEvent", data, status);
            };

            var apiVer = '/fineract-provider/api/v1';

            var getUserDetails = function(response){
                var data = response.data;
                localStorageService.addToLocalStorage('tokendetails', data);
                setTimer(data.expires_in);
                httpService.get( apiVer + "/userdetails?access_token=" + data.access_token)
                .then(onLoginSuccess)
                .catch(onLoginFailure);
            }

            var updateAccessDetails = function(response){
                var data = response.data;
                var sessionData = webStorage.get('sessionData');
                sessionData.authenticationKey = data.access_token;
                webStorage.add("sessionData",sessionData);
                localStorageService.addToLocalStorage('tokendetails', data);
                var userDate = localStorageService.getFromLocalStorage("userData");
                userDate.accessToken =  data.access_token;
                localStorageService.addToLocalStorage('userData', userDate);
                httpService.setAuthorization(data.access_token);
                setTimer(data.expires_in);
            }

            var setTimer = function(time){
                timeout(getAccessToken, time * 1000);
            }            

            /*oauth implementation - start*/

            var onLoginSuccess_oauth = function (response) {
                var data = JSON.parse(response);
                if(data.isTwoFactorAuthenticationRequired != null && data.isTwoFactorAuthenticationRequired == true) {
                    if(hasValidTwoFactorToken(data.username)) {
                        var token = getTokenFromStorage(data.username);
                        onTwoFactorRememberMe(data, token);
                    } else {
                        userData = data;
                        scope.$broadcast("UserAuthenticationTwoFactorRequired", data);
                    }
                } else {
                    scope.$broadcast("UserAuthenticationSuccessEvent", data);
                    localStorageService.addToLocalStorage('userData', data);
                }
            };    

            var onLoginFailure_oauth = function (response) {
                var data = JSON.parse(response);
                var status = data.status ? data.status : 401;
                scope.$broadcast("UserAuthenticationFailureEvent", data, status);
            };            

            var getUserDetails_oauth = function(response){
                var data = JSON.parse(response);
                if (data.error)
                {
                    onLoginFailure_oauth(response);
                }
                else {
                    localStorageService.addToLocalStorage('tokendetails', data);
                    setTimer(data.expires_in);
                    var myHeaders = new Headers();
                    
                    if (QueryParameters["tenantIdentifier"]) {
                        myHeaders.append("Fineract-Platform-TenantId", QueryParameters["tenantIdentifier"]);
                    }
                    else
                    {
                        myHeaders.append("Fineract-Platform-TenantId", "default");
                    }
                    
                    myHeaders.append("Authorization", "Bearer " + data.access_token);
    
                    var requestOptions = {
                    method: 'GET',
                    headers: myHeaders,
                    redirect: 'follow'
                    };
                    
                    var mainLink = getLocation(window.location.href);
                    var baseApiUrlEnv = FINERACT_BASE_URL;
    
                    if (mainLink.hostname != "") {
                        baseApiUrl = "https://" + mainLink.hostname + (mainLink.port ? ':' + mainLink.port : '');
                    }
        
                    if (QueryParameters["baseApiUrl"]) {
                        baseApiUrl = QueryParameters["baseApiUrl"];
                    }
        
                    if (baseApiUrlEnv !== '$FINERACT_BASE_URL') {
                        baseApiUrl = baseApiUrlEnv;
                    }
        
                    var queryLink = getLocation(baseApiUrl);
                    var host = "https://" + queryLink.hostname + (queryLink.port ? ':' + queryLink.port : '');
    
                    fetch(host + apiVer + "/userdetails", requestOptions)
                    .then(response => response.text())
                    .then(onLoginSuccess_oauth)
                    .catch(onLoginFailure_oauth);
                }                
            }

            var updateAccessDetails_oauth = function(response){
                var data = JSON.parse(response);
                var sessionData = webStorage.get('sessionData');
                sessionData.authenticationKey = data.access_token;
                webStorage.add("sessionData",sessionData);
                localStorageService.addToLocalStorage('tokendetails', data);
                var userDate = localStorageService.getFromLocalStorage("userData");
                userDate.accessToken =  data.access_token;
                localStorageService.addToLocalStorage('userData', userDate);
                httpService.setAuthorization(data.access_token);
                setTimer(data.expires_in);
            }
            
            

            var getAccessToken = function(){
                var refreshToken = localStorageService.getFromLocalStorage("tokendetails").refresh_token;
                httpService.cancelAuthorization();

                var myHeaders = new Headers();
                myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

                var urlencoded = new URLSearchParams();
                urlencoded.append("client_id", OAUTH_JWT_CLIENT_ID);
                urlencoded.append("grant_type", "refresh_token");
                urlencoded.append("refresh_token", refreshToken);
                urlencoded.append("client_secret", OAUTH_JWT_CLIENT_SECRET);

                var requestOptions = {
                method: 'POST',
                headers: myHeaders,
                body: urlencoded,
                redirect: 'follow'
                };

                fetch(OAUTH_JWT_SERVER_URL + "/realms/" + OAUTH_REALM + "/protocol/openid-connect/token", requestOptions)
                .then(response => response.text())
                .then(updateAccessDetails_oauth);

                /*httpService.post( "/fineract-provider/api/oauth/token?&client_id=mifos-staging&grant_type=refresh_token&client_secret=rTuer2P0eV20EUus5kp2mowHb9DxRIja&refresh_token=" + refreshToken)
                .then(updateAccessDetails);*/
            }

            this.authenticateWithUsernamePassword = function (credentials) {
                scope.$broadcast("UserAuthenticationStartEvent");
        		if(SECURITY === 'oauth'){
                    var myHeaders = new Headers();
                    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

                    var urlencoded = new URLSearchParams();
                    urlencoded.append("client_id", OAUTH_JWT_CLIENT_ID);
                    urlencoded.append("grant_type", "password");
                    urlencoded.append("scope", "openid");
                    urlencoded.append("username", credentials.username);
                    urlencoded.append("password", credentials.password);
                    urlencoded.append("client_secret", OAUTH_JWT_CLIENT_SECRET);

                    var requestOptions = {
                    method: 'POST',
                    headers: myHeaders,
                    body: urlencoded,
                    redirect: 'follow'
                    };

                    fetch(OAUTH_JWT_SERVER_URL + "/realms/" + OAUTH_REALM + "/protocol/openid-connect/token", requestOptions)
                    .then(response => response.text())
                    .then(getUserDetails_oauth)
                    .catch(onLoginFailure_oauth);
                    
                    /*httpService.post( "/fineract-provider/api/oauth/token?username=" + credentials.username + "&password=" + credentials.password +"&client_id=mifos-staging&grant_type=password&client_secret=rTuer2P0eV20EUus5kp2mowHb9DxRIja")
                    .then(getUserDetails)
                    .catch(onLoginFailure);*/
        		} else {
                    httpService.post(apiVer + "/authentication", { "username": credentials.username, "password": credentials.password})
                    .then(onLoginSuccess)
                    .catch(onLoginFailure);
        		}
            };

            /*oauth implementation - end*/

            var onTwoFactorRememberMe = function (userData, tokenData) {
                var accessToken = tokenData.token;
                twoFactorAccessToken = accessToken;
                httpService.setTwoFactorAccessToken(accessToken);
                scope.$broadcast("UserAuthenticationSuccessEvent", userData);
                localStorageService.addToLocalStorage('userData', userData);
            };

            var onOTPValidateSuccess = function (response) {
                var data = response.data;
                var accessToken = data.token;
                if(twoFactorIsRememberMeRequest) {
                    saveTwoFactorTokenToStorage(userData.username, data);
                }
                twoFactorAccessToken = accessToken;
                httpService.setTwoFactorAccessToken(accessToken);
                scope.$broadcast("UserAuthenticationSuccessEvent", userData);
                localStorageService.addToLocalStorage('userData', userData);
            };

            var onOTPValidateError = function (response) {
                var data = response.data;
                var status = response.status;
                scope.$broadcast("TwoFactorAuthenticationFailureEvent", data, status);
            };

            var getTokenFromStorage = function (user) {
                var twoFactorStorage = localStorageService.getFromLocalStorage("twofactor");

                if(twoFactorStorage) {
                    return twoFactorStorage[user]
                }
                return null;
            };

            var saveTwoFactorTokenToStorage = function (user, tokenData) {
                var storageData = localStorageService.getFromLocalStorage("twofactor");
                if(!storageData) {
                    storageData = {}
                }
                storageData[user] = tokenData;
                localStorageService.addToLocalStorage('twofactor', storageData);
            };

            var removeTwoFactorTokenFromStorage = function (username) {
                var storageData = localStorageService.getFromLocalStorage("twofactor");
                if(!storageData) {
                    return;
                }

                delete storageData[username]
                localStorageService.addToLocalStorage('twofactor', storageData);
            };

            var hasValidTwoFactorToken = function (user) {
                var token = getTokenFromStorage(user);
                if(token) {
                    return (new Date).getTime() + 7200000 < token.validTo;
                }
                return false;
            };

            this.validateOTP = function (token, rememberMe) {
                twoFactorIsRememberMeRequest = rememberMe;
                httpService.post(apiVer + "/twofactor/validate?token=" + token)
                    .then(onOTPValidateSuccess)
                    .catch(onOTPValidateError);
            };

            scope.$on("OnUserPreLogout", function (event) {
                var userDate = localStorageService.getFromLocalStorage("userData");

                // Remove user data and two-factor access token if present
                localStorageService.removeFromLocalStorage("userData");
                removeTwoFactorTokenFromStorage(userDate.username);

                httpService.post(apiVer + "/twofactor/invalidate", '{"token": "' + twoFactorAccessToken + '"}');
            });
        }
    });
    mifosX.ng.services.service('AuthenticationService', ['$rootScope', 'HttpService', 'SECURITY', 'OAUTH_REALM', 'OAUTH_JWT_SERVER_URL', 'OAUTH_JWT_CLIENT_ID', 'FINERACT_BASE_URL', 'OAUTH_JWT_CLIENT_SECRET', 'localStorageService','$timeout','webStorage', mifosX.services.AuthenticationService]).run(function ($log) {
        $log.info("AuthenticationService initialized");
    });
}(mifosX.services || {}));
