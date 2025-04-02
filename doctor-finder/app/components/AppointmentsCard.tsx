
import { Button } from '@/components/ui/button';
import { Star, Shield, MessageCircle, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db as getFirebaseDb, useAuth } from '../authcontext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, isBefore, startOfDay } from 'date-fns';
import { DialogTrigger } from '@radix-ui/react-dialog';
import DoctorProfileImage from '../viewDoctor/[id]/components/DoctorProfileImage';
import StarRating from '../viewDoctor/[id]/components/StarRating';
import useUserLocation from '../hooks/useUserLocation';




interface AppointmentsCardProps {
  id: string;
  doctorId: string;
  datetime: Timestamp;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  doctorInfo: {
    name: string;
    specialty: string;
    degree: string;
    location: string;
  };
  visitDetails: {
    reason: string;
    insurance: string;
    patientType: 'new' | 'returning';
    notes?: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
}

type DistanceCache = {
  [key: string]: number;
};
const distanceCache: DistanceCache = {};
export default function AppointmentsCard({
  id,
  doctorInfo,
  visitDetails,
  doctorId,
  status,
  coordinates,
  datetime = new Timestamp(0, 0),
}: AppointmentsCardProps) {

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const day = weekday[datetime.toDate().getDay()];
  const month = months[datetime.toDate().getMonth()];
  const date = datetime.toDate().getDate();
  const year = datetime.toDate().getFullYear();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starCount, setStarCount] = useState(0);
  const [review, setReview] = useState('');
  const { user } = useAuth();
  const currentTime = useMemo(() => new Date(), []);
  const [availabilityData, setAvailabilityData] = useState<{ [key: string]: string[] }>({});
  const { toast } = useToast();
  const { coordinates: userCoords } = useUserLocation();
  const [distance, setDistance] = useState<number | null>(null);

  // calculate distance when coordinates change
  useEffect(() => {
    if (!userCoords || !coordinates) return;

    // create a cache key from both coordinates
    const cacheKey = `${userCoords.lat},${userCoords.lng}-${coordinates.lat},${coordinates.lng}`;

    // check if we already calculated this distance
    if (distanceCache[cacheKey] !== undefined) {
      setDistance(distanceCache[cacheKey]);
      return;
    }

    // calculate and cache the distance
    const calculatedDistance = calculateDistance(
      userCoords.lat,
      userCoords.lng,
      coordinates.lat,
      coordinates.lng
    );

    distanceCache[cacheKey] = calculatedDistance;
    setDistance(calculatedDistance);
  }, [userCoords, coordinates]);

  // calculate distance
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // fetch doctor data
  useEffect(() => {
    const fetchDoctor = async () => {
      const db = getFirebaseDb();
      const doctorRef = doc(db, 'users', doctorId);
      try {
        const doctorSnap = await getDoc(doctorRef);
        if (doctorSnap.exists()) {
          setDoctor(doctorSnap.data());
        } else {
          console.error(`No doctor found with id: ${doctorId}`);
          setError('Doctor not found');
        }
      } catch (err) {
        console.error('Error fetching doctor:', err);
        setError('Failed to fetch doctor');
      } finally {
        setLoading(false);
      }
    };

    // if user is logged in, fetch doctor data
    if (user) {
      fetchDoctor();
    } else {
      setLoading(false);
    }
  }, [doctorId, user]);


  // // fetch availability data
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!doctorId) return;
      try {
        const db = getFirebaseDb();
        if (!db) {
          console.error('Firebase DB not initialized');
          return;
        }

        const availabilityRef = doc(db, 'availability', doctorId);
        const availabilityDoc = await getDoc(availabilityRef);

        if (availabilityDoc.exists()) {
          const data = availabilityDoc.data() as { [key: string]: string[] };
          const filteredData: { [key: string]: string[] } = {};

          Object.entries(data).forEach(([dateStr, timeSlots]) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);

            if (!isBefore(startOfDay(date), startOfDay(currentTime))) {
              if (format(date, 'yyyy-MM-dd') === format(currentTime, 'yyyy-MM-dd')) {
                const futureSlots = timeSlots.filter(timeStr => {
                  const [hours, minutes] = timeStr.split(':').map(Number);
                  const slotTime = new Date(year, month - 1, day, hours, minutes);
                  return !isBefore(slotTime, currentTime);
                });
                if (futureSlots.length > 0) {
                  filteredData[dateStr] = futureSlots;
                }
              } else {
                filteredData[dateStr] = timeSlots;
              }
            }
          });

          setAvailabilityData(filteredData);
        }
      } catch (error) {
        console.error('Error fetching availability:', error);
      }
    };

    if (user) {
      fetchAvailability();
    }
  }, [doctorId, user, currentTime]);


  const getNextAvailable = () => {
    if (!availabilityData) return null;

    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isAfterWorkday = currentHour >= 17; // 5 PM 

    // sort dates
    const dates = Object.keys(availabilityData).sort();

    for (const date of dates) {
      // skip dates before today
      if (date < today) continue;

      const times = availabilityData[date];

      // if it's today and after work hours, skip today entirely
      if (date === today && isAfterWorkday) {
        continue;
      }

      // if it's today, filter out past times
      if (date === today) {
        const validTimes = times.filter(time => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours > currentHour || (hours === currentHour && minutes > currentMinute);
        });
        if (validTimes.length > 0) {
          return { date, time: validTimes[0] };
        }
      } else {
        // for future dates, return first available time
        if (times.length > 0) {
          return { date, time: times[0] };
        }
      }
    }
    return null;
  };
  const nextAvailableAppointment = getNextAvailable();
  const nextAvailableText = nextAvailableAppointment
    ? format(new Date(`${nextAvailableAppointment.date}T${nextAvailableAppointment.time}`), 'EEE, MMM d')
    : 'No availability';



  const handleReviewSubmit = async () => {
    if (review.length === 0 && starCount === 0) {
      return;
    }


    try {
      const db: any = getFirebaseDb();
      const reviewsRef = collection(db, 'reviews');

      await addDoc(reviewsRef, {
        rating: starCount,
        review: review.trim(),
        appointmentId: id,
        doctorName: doctorInfo.name,
        doctorId: doctorId,
        reviewedBy: user?.uid,
        reviewerEmail: user?.email,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      toast({
        title: "Review Submitted",
        description: "Thank you for your review.",
        className: "bg-primary text-white",
      });

      setReviewDialogOpen(false);
      setReview('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        variant: "destructive",
        title: "Review Failed",
        description: "There was a problem submitting your review. Please try again.",
      });
    }
  };

  const fillStars = () => {
    const starMap = new Map();
    for (let index = 1; index <= 5; index++) {
      //add fill stars
      if(index <= starCount){
        starMap.set(index, <Star className="w-4 h-4 sm:w-14 sm:h-14 text-blue-400 fill-current" />);
      } 
      //unfill stars
      else {
        starMap.set(index, <Star className="w-2 h-2 sm:w-14 sm:h-14 text-blue-400 unfill-current " strokeWidth={1.5} />);
      }
    }
    return <>
      <div className='flex flex-row gap-4 items-center'>
        {
          Array.from(starMap.values(), (star, index: number) =>
            <div key={index} >
              <button
                onClick={() => setStarCount(index + 1)}
                onMouseEnter={() => setStarCount(index + 1)}
                onMouseLeave={() => starCount == 1 ? setStarCount(index - 1) : <></>}
              > {star}
              </button>
            </div>,
          )
        }
      </div>
    </>
  }


  return (
    <>

      <div className="flex gap-2 flex-col lg:flex-row flex-1 items-center lg:items-start justify-between w-full max-w p-4  ">
        <div className="flex flex-col md:flex-row md:items-center space-x-4">
          <div className="profile-image">
            <DoctorProfileImage profileImage={doctor?.profileImage} />
          </div>
          <div className='flex flex-col'>
            <div className='flex justify-left text-gray-500 mb-2 text-[15px] lg:-indent-36 mt-2' >
              {day}, {month} {date} {year}
            </div>
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-200"> {doctorInfo.name}</span>
            <h3 className="text-gray-500 text-sm 1px mb-2">{doctorInfo.specialty}</h3>

            <div className='flex mb-2 space-y-1 mr-8' >
              <div>
                <div className='flex gap-2'> <Star className="flex-shrink-0 w-5 h-5 text-yellow-400 unfill-current mb-2" /> <div>{doctor?.rating} · {doctor?.reviewCount == null ? 0 : doctor?.reviewCount}  Reviews </div></div>
                <div className='flex gap-2' > <MapPin className="flex-shrink-0 w-5 h-5 text-black-500 mb-2" /> {distance !== null ? `${distance} mi · ` : ''} {doctorInfo.location}</div>
                <div className='flex gap-2' ><Shield className="flex-shrink-0 w-5 h-5 text-blue-500 mb-2" />
                  <div>Accepts  {doctor?.acceptedInsurances.slice(0, 3).join(', ')}
                    {doctor?.acceptedInsurances?.length > 3 && (
                      <span className="text-gray-500"> + {doctor.acceptedInsurances.length - 3} more</span>
                    )}
                  </div>
                </div>
                <div className='flex gap-2' ><MessageCircle className="flex-shrink-0 w-5 h-5 text-black-500 mb-2 " />
                  <div>Speaks {doctor?.spokenLanguages.slice(0, 3).join(', ')}
                  </div> {doctor?.spokenLanguages?.length > 3 && (<span className="text-gray-500 ">+ {doctor.spokenLanguages.length - 3} more</span>
                  )}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="Buttons">
          <div className="flex flex-col gap-2 items-end">
            <p className="hidden xl:block text-sm text-gray-500 mb-3 text-center dark:text-gray-400">Next available: {nextAvailableText}</p>

            <Link href={`/viewDoctor/${doctorId}`}>
              <div className="inline-flex w-full xl:w-auto items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 min-w-[200px]">
                Book Again
              </div>
            </Link>


            <Dialog
              open={reviewDialogOpen}
              onOpenChange={(open) => {
                setReviewDialogOpen(open);
                if (!open) {
                  setReview('');
                  setStarCount(0);
                  console.log(open);
                }
              }}
            >

              <div onClick={() => setReviewDialogOpen(!reviewDialogOpen)} className="inline-flex w-full xl:w-auto items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background  bg-[#829eb5] text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 min-w-[200px]">
                Leave a Review
              </div>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className='flex items-center'>Write a review</DialogTitle>
                  <div className='flex flex-row'>
                    <div className="profile-image">
                      <DoctorProfileImage profileImage={doctor?.profileImage} />
                    </div>
                    <div className='flex flex-col space-x-8 mb-2 items-center sm:items-start'>
                      <div className="flex justify-start text-xl font-semibold text-gray-800 mt-4 c sm:ml-8  dark:text-white"> {doctorInfo.name}</div>
                      <div className="text-gray-500 text-lg 1px dark:text-white mr-10 sm:ml-10">{doctorInfo.specialty}</div>
                      <div > {doctorInfo.location}</div>
                    </div>
                  </div>
                  <hr className="border-gray-200 mb-2" />

                </DialogHeader>
                <div className='flex justify-center'>{fillStars()}</div>

                <div>
                  <textarea
                    className="w-full min-h-[100px] p-3 rounded-md border border-gray-200 focus:outline-none focus:border-gray-300"
                    placeholder="Reviews write here..."
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                  />
                  <Button
                    className="w-full"
                    onClick={handleReviewSubmit}
                    disabled={review.length == 0 && starCount == 0}
                  >
                    Submit
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <p className="xl:hidden text-xs text-gray-500 mt-2 text-center dark:text-gray-400">Next available: {nextAvailableText}</p>

            <Dialog>
              <DialogTrigger>
                <div className="text-gray-800 inline-flex items-center px-1 pt-1 hover:text-gray-600 dark:text-white dark:hover:text-gray-300 relative group">
                  <span className="relative">
                    Visit Details
                    <span className="absolute left-0 bottom-0 w-full h-0.5 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
                  </span>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Visit Details</DialogTitle>
                  <hr className="border-gray-200 mb-2" />
                </DialogHeader>
                <div className='flex justify-center flex-col'>
                  <h1 className='font-semibold'>Booked: {day}, {month} {date} {year}</h1>
                  <div>Reason: {visitDetails.reason != null ? `${visitDetails.reason}` : 'General check up'}</div>
                  <div>Notes:  {visitDetails.notes != null ? `${visitDetails.notes}` : 'None'}</div>
                  {/* <div>Status: {status}</div> */}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div >
    </>
  )
}


