import { useEffect, useRef } from 'react';
import { createSDK } from '@volant-autonomy/via-sdk';
import supabase from '../../supabaseClient';

export default function GenerateRouteMission({
  drone,
  fireLocation,
  homeLocation,
  realTimeLocation,
  missionId,
  onRouteGenerated,
  trigger,
  addExtraPoint = false  // 👈 NUEVA PROP: por defecto false
}) {
  const lastTrigger = useRef(null);
  const isGenerating = useRef(false);
  const DEFAULT_ALTITUDE = { 
    value: 100, 
    units: 'm',
    reference: 'AGL'
  };

  useEffect(() => {
    if (!drone || !drone.uid || !fireLocation) return;
    if (lastTrigger.current === trigger || isGenerating.current) return;

    lastTrigger.current = trigger;
    isGenerating.current = true;

    async function generateRoute() {
      try {
        let fixedHomeLocation = homeLocation
          ? { lat: Number(homeLocation.lat), lng: Number(homeLocation.lng) }
          : null;

        if (!fixedHomeLocation) {
          const { data: droneData, error: droneError } = await supabase
            .from('DroneList')
            .select('latitude, longitude')
            .eq('uid', drone.uid)
            .single();

          if (droneError || !droneData) {
            console.error('Failed to get home location from DroneList', droneError);
            isGenerating.current = false;
            return;
          }

          fixedHomeLocation = {
            lat: Number(droneData.latitude),
            lng: Number(droneData.longitude),
          };
        }

        let startLocation = fixedHomeLocation;

        if (realTimeLocation && realTimeLocation.lat && realTimeLocation.lng) {
          startLocation = {
            lat: Number(realTimeLocation.lat),
            lng: Number(realTimeLocation.lng)
          };
          console.log('Using real-time drone location as start point');
        } else {
          console.log('Using home location as start point (no real-time data)');
        }

        const SDK = createSDK({
          username: import.meta.env.VITE_USERNAME_SDK,
          password: import.meta.env.VITE_PASSWORD_SDK,
        });

        const baseFlightParams = {
          airspeed: 20,
          lateral: { contingency_buffer: 50, manoeuvre_corridor: 100, tse: 30 },
          vertical: { tse: 30 },
        };
        const pathingSettings = { deconflict: true, ground_risk_bias: 0.8 };
        const windParams = { direction: 130, speed: 5 };

        console.log('📤 Enviando a SDK - routeToFire:', {
          startLocation,
          fireLocation,
          baseFlightParams,
          pathingSettings,
          windParams
        });

        const routeToFire = await SDK.composite.doPathingTask({
          chart_id: 'bcndc',
          time: new Date().toISOString(),
          time_mode: 'depart_at',
          tse_temporal: 60,
          permitted_ids: [],
          volume_settings: {},
          checkpoints: [
            { 
              type: 'start', 
              position: { 
                lat: Number(startLocation.lat), 
                lng: Number(startLocation.lng),
                altitude: DEFAULT_ALTITUDE
              } 
            },
            { 
              type: 'goto', 
              position: { 
                lat: Number(fireLocation.lat), 
                lng: Number(fireLocation.lng),
                altitude: DEFAULT_ALTITUDE
              },
              parameters: {
                flight_parameters: baseFlightParams,
                pathing_settings: pathingSettings,
                wind_parameters: windParams
              }
            },
          ],
        });

        console.log('📥 Respuesta SDK routeToFire:', JSON.stringify(routeToFire, null, 2));

        // Variables para los waypoints
        let fireWaypoints = [];
        let homeWaypoints = [];

        // Verificar si la ruta fue exitosa
        if (routeToFire?.data?.meta?.state === 'successful') {
          fireWaypoints = routeToFire.data.attributes?.waypoints || [];
          console.log('🔥 Ruta SDK exitosa con', fireWaypoints.length, 'waypoints');
          
          // Solo intentar ruta de vuelta si la ida fue exitosa
          if (fireWaypoints.length > 0) {
            const routeToHome = await SDK.composite.doPathingTask({
              chart_id: 'bcndc',
              time: new Date().toISOString(),
              time_mode: 'depart_at',
              tse_temporal: 60,
              permitted_ids: [],
              volume_settings: {},
              checkpoints: [
                { 
                  type: 'start', 
                  position: { 
                    lat: Number(fireLocation.lat),
                    lng: Number(fireLocation.lng),
                    altitude: DEFAULT_ALTITUDE
                  } 
                },
                { 
                  type: 'goto', 
                  position: { 
                    lat: Number(fixedHomeLocation.lat),
                    lng: Number(fixedHomeLocation.lng),
                    altitude: DEFAULT_ALTITUDE
                  }, 
                  parameters: { 
                    flight_parameters: baseFlightParams, 
                    pathing_settings: pathingSettings, 
                    wind_parameters: windParams 
                  } 
                },
              ],
            });
            
            homeWaypoints = routeToHome?.data?.attributes?.waypoints || [];
            console.log('🏠 Waypoints vuelta:', homeWaypoints.length);
          }
        } else {
          // El SDK falló - verificamos el motivo
          // 👇 CORREGIDO: Leer el error desde la estructura correcta
          let errorCode = routeToFire?.data?.meta?.error_code;
          let errorMsg = routeToFire?.data?.meta?.error_message;
          
          // Si no hay error en meta, buscar en errors array
          if (!errorCode && routeToFire?.errors?.length > 0) {
            const firstError = routeToFire.errors[0];
            errorMsg = firstError?.detail || 'Unknown error';
            // Detectar error específico por el mensaje
            if (errorMsg?.includes('exceed bounds')) {
              errorCode = 2003; // Código para "out of bounds"
            } else if (errorMsg?.includes('altitude')) {
              errorCode = 2016;
            } else {
              errorCode = 2002; // Código genérico para "no path"
            }
            console.log(`📝 Error detectado desde errors array: ${errorMsg} (código asignado: ${errorCode})`);
          }
          
          console.log(`⚠️ SDK falló (${errorCode}): ${errorMsg}`);

          // Crear ruta simple si es error de límites del mapa o altitud
          if (errorCode === 2002 || errorCode === 2016 || errorCode === 2003) {
            console.log('✈️ Usando ruta simple con vuelta (inicio → fuego → inicio)');
            
            // Ruta continua: inicio → fuego → inicio (3 puntos)
            fireWaypoints = [
              {
                position: {
                  lat: Number(startLocation.lat),
                  lng: Number(startLocation.lng),
                  altitude: DEFAULT_ALTITUDE
                }
              },
              {
                position: {
                  lat: Number(fireLocation.lat),
                  lng: Number(fireLocation.lng),
                  altitude: DEFAULT_ALTITUDE
                }
              },
              {
                position: {
                  lat: Number(fixedHomeLocation.lat),
                  lng: Number(fixedHomeLocation.lng),
                  altitude: DEFAULT_ALTITUDE
                }
              }
            ];
            
            homeWaypoints = [];
            console.log('🚀 Ruta simple IDA+VUELTA creada (3 puntos continuos)');
            
          } else {
            // Si es otro error, no podemos continuar
            console.error('❌ Error de SDK no manejado, abortando generación de ruta');
            isGenerating.current = false;
            return;
          }
        } 

        // Combinar waypoints
        const combinedData = [...fireWaypoints, ...homeWaypoints];

        if (!combinedData.length) {
          console.error('Empty route');
          isGenerating.current = false;
          return;
        }

        const waypoints = combinedData.map(wp => ({
          lat: wp.position.lat,
          lng: wp.position.lng,
          alt: DEFAULT_ALTITUDE.value,
        }));

        // 👇 SOLO añadir punto extra si addExtraPoint es true (modo control manual)
        if (addExtraPoint && waypoints.length > 0) {
          waypoints.push({ ...waypoints[waypoints.length - 1] });
          console.log(`📍 Punto extra añadido al final (modo control)`);
        }

        console.log(`📍 Waypoints generados: ${waypoints.length} puntos`);
        waypoints.forEach((wp, i) => {
          console.log(`  ${i+1}: (${wp.lat.toFixed(6)}, ${wp.lng.toFixed(6)})`);
        });

        const latRounded = Number(fireLocation.lat.toFixed(6));
        const lngRounded = Number(fireLocation.lng.toFixed(6));

        let missionToUpdate = null;

        if (missionId) {
          const { data: missionData, error: missionError } = await supabase
            .from('missions')
            .select('*')
            .eq('id', missionId)
            .single();

          if (!missionError && missionData) {
            missionToUpdate = missionData;
          } else {
            console.error('Mission with provided ID not found', missionError);
          }
        }

        if (!missionToUpdate) {
          const { data: existingMissions, error: searchError } = await supabase
            .from('missions')
            .select('*')
            .eq('drone', drone.uid)
            .eq('latitud', latRounded)
            .eq('longitude', lngRounded)
            .order('time', { ascending: false })
            .limit(1);

          if (!searchError && existingMissions && existingMissions.length > 0) {
            missionToUpdate = existingMissions[0];
          } else {
            console.error('No existing mission found to update');
          }
        }

        let finalMissionId = null;

        if (missionToUpdate) {
          const { data: updatedMission, error: updateError } = await supabase
            .from('missions')
            .update({ 
              waypoints: waypoints,
              time: new Date().toISOString()
            })
            .eq('id', missionToUpdate.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating mission', updateError);
          } else {
            finalMissionId = updatedMission.id;
            console.log('Mission updated successfully');
            
            if (onRouteGenerated) {
              onRouteGenerated({ 
                id: finalMissionId, 
                waypoints,
                startLocation: startLocation,
                homeLocation: fixedHomeLocation
              });
            }
          }
        } else {
          console.error('No existing mission to update. Operation canceled.');
        }

      } catch (err) {
        console.error('Error generating route:', err);
      } finally {
        isGenerating.current = false;
      }
    }

    generateRoute();
  }, [trigger, drone, fireLocation, homeLocation, realTimeLocation, missionId, onRouteGenerated]);

  return null;
}